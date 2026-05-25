import logging
from decimal import Decimal

import requests
from django.conf import settings
from django.db.models import Sum

logger = logging.getLogger(__name__)


class PaymentSMSService:
    """
    Sends payment confirmation SMS to the student's guardian.

    Delivery priority:
      1. School-specific HTTP API  (config.sms_api_url + config.sms_api_key set)
      2. System-level Twilio REST  (fallback — uses requests, no SDK required)

    All methods use safe_send() which swallows exceptions so that a failed SMS
    never rolls back a committed payment transaction.
    """

    @staticmethod
    def safe_send(event_id: str) -> None:
        """
        Entry point for transaction.on_commit() callbacks.
        Logs errors but never raises — SMS failure must never affect payment
        confirmation.
        """
        try:
            PaymentSMSService._send(event_id)
        except Exception as exc:
            logger.error(
                'Payment SMS failed for event_id=%s: %s',
                event_id,
                exc,
                exc_info=True,
            )

    @staticmethod
    def _send(event_id: str) -> None:
        # Lazy import to avoid circular dependency
        from apps.payments.models import PaymentEvent
        from apps.fees.models import FeeBalance

        event = (
            PaymentEvent.unscoped
            .select_related('student', 'payment_config', 'school')
            .get(id=event_id)
        )

        # ── Guard checks ──────────────────────────────────────────────────────
        student = event.student
        if not student:
            logger.info('SMS skipped: no student linked to event %s', event_id)
            return

        guardian_phone = getattr(student, 'guardian_phone', None)
        if not guardian_phone:
            logger.info(
                'SMS skipped: no guardian_phone for student %s',
                student.admission_number,
            )
            return

        config = event.payment_config
        if not config.sms_enabled:
            logger.info('SMS skipped: sms_enabled=False on config %s', config.id)
            return

        # ── Compute outstanding balance ────────────────────────────────────────
        # FeeBalance uses the default Django manager (no SchoolManager).
        balance_result = FeeBalance.objects.filter(
            school=event.school,
            student=student,
        ).aggregate(total=Sum('closing_balance'))
        balance = balance_result['total'] or Decimal('0.00')

        # ── Compose message ───────────────────────────────────────────────────
        guardian_name = getattr(student, 'guardian_name', 'Parent/Guardian')
        student_name = getattr(student, 'full_name', student.admission_number)
        school_name = event.school.name

        message = (
            f'Dear {guardian_name}, KES {event.amount:,.0f} received for '
            f'{student_name} ({student.admission_number}). '
            f'Ref: {event.transaction_code}. '
            f'Balance: KES {balance:,.0f}. - {school_name}'
        )

        # ── Dispatch ──────────────────────────────────────────────────────────
        if config.sms_api_url and config.sms_api_key:
            PaymentSMSService._send_via_http(
                url=config.sms_api_url,
                api_key=config.sms_api_key,
                sender_id=config.sms_sender_id,
                to=guardian_phone,
                message=message,
            )
        else:
            PaymentSMSService._send_via_twilio(
                to=guardian_phone,
                message=message,
            )

    @staticmethod
    def _send_via_http(
        url: str,
        api_key: str,
        sender_id: str,
        to: str,
        message: str,
    ) -> None:
        """Send SMS via a school-specific HTTP API."""
        response = requests.post(
            url,
            json={
                'to': to,
                'message': message,
                'sender_id': sender_id,
            },
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            timeout=10,
        )
        response.raise_for_status()
        logger.info('SMS sent via school HTTP provider to %s', to)

    @staticmethod
    def _send_via_twilio(to: str, message: str) -> None:
        """
        Send SMS via the Twilio REST API using requests (no Twilio SDK needed).
        Endpoint: POST /2010-04-01/Accounts/{sid}/Messages.json
        """
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '')

        if not all([account_sid, auth_token, from_number]):
            logger.warning(
                'Twilio credentials not fully configured — SMS to %s not sent.', to
            )
            return

        url = (
            f'https://api.twilio.com/2010-04-01/Accounts/'
            f'{account_sid}/Messages.json'
        )
        response = requests.post(
            url,
            data={
                'To': to,
                'From': from_number,
                'Body': message,
            },
            auth=(account_sid, auth_token),
            timeout=10,
        )
        response.raise_for_status()
        logger.info('SMS sent via Twilio to %s', to)
