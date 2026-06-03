import logging
from decimal import Decimal

from django.db import transaction
from django.utils.timezone import now

from apps.fees.models import FeeBalance, PaymentTransaction
from apps.fees.services import apportion_payment, apply_payment_to_balances
from apps.payments.models import PaymentEvent, SchoolPaymentConfig, PaymentIngressLog
from apps.payments.providers.base import PaymentEventData

logger = logging.getLogger(__name__)

PAYMENT_SYSTEM_VERSION = '1.0.0'


def _set_school_context(school):
    """
    Temporarily set the thread-local school context so that SchoolManager
    (used by Student.objects) filters correctly in webhook processing where
    no HTTP middleware has run.
    Returns the previous school value for restoration.
    """
    from apps.core.middleware import _request_local
    previous = getattr(_request_local, 'school', None)
    _request_local.school = school
    return previous


def _restore_school_context(previous):
    from apps.core.middleware import _request_local
    _request_local.school = previous


class ReconciliationService:
    """
    Atomic ledger reconciliation service.

    reconcile()   — called by PaymentProcessor for new payments
    reprocess()   — called by admin for failed UNRESOLVED_STUDENT /
                    INVALID_REFERENCE events after the root cause is fixed
    """

    @staticmethod
    @transaction.atomic
    def reconcile(
        data: PaymentEventData,
        config: SchoolPaymentConfig,
        ingress_log: PaymentIngressLog,
    ) -> PaymentEvent:
        """
        Process a single inbound payment end-to-end within one DB transaction.

        On success:   PaymentEvent(RECONCILED) + fees.PaymentTransaction created
        On bad ref:   PaymentEvent(UNRESOLVED_STUDENT | INVALID_REFERENCE) — no fee record
        """
        idempotency_key = f'{data.provider}:{data.transaction_code}'

        # ── Create PaymentEvent in RECEIVED state ──────────────────────────────
        # We explicitly set school so SchoolScopedModel.save() does not call
        # get_current_school() (which would return None in webhook context).
        event = PaymentEvent(
            school=config.school,
            ingress_log=ingress_log,
            idempotency_key=idempotency_key,
            provider=data.provider,
            transaction_code=data.transaction_code,
            amount=data.amount,
            phone_number=data.phone_number,
            reference=data.reference,
            payment_config=config,
            status='RECEIVED',
            system_version=PAYMENT_SYSTEM_VERSION,
        )
        event.save()

        # ── Temporarily activate school context for SchoolManager queries ──────
        # Student.objects uses SchoolManager which filters by the thread-local
        # school. Without this, webhook processing (no HTTP request) would get
        # school=None and find no students.
        prev_school = _set_school_context(config.school)
        try:
            return ReconciliationService._reconcile_inner(event, data, config)
        finally:
            _restore_school_context(prev_school)

    @staticmethod
    def _reconcile_inner(
        event: PaymentEvent,
        data: PaymentEventData,
        config: SchoolPaymentConfig,
    ) -> PaymentEvent:
        from apps.students.models import Student

        # ── Resolve student by admission_number ────────────────────────────────
        try:
            student = Student.objects.get(
                admission_number=data.reference.strip().upper(),
            )
        except Student.DoesNotExist:
            event.status = 'UNRESOLVED_STUDENT'
            event.error_message = (
                f"No student with admission_number={data.reference!r} "
                f"in school {config.school.code!r}."
            )
            event.processed_at = now()
            event.save()
            logger.warning(
                'Payment UNRESOLVED_STUDENT: ref=%s school=%s',
                data.reference,
                config.school.code,
            )
            return event
        except Student.MultipleObjectsReturned:
            event.status = 'INVALID_REFERENCE'
            event.error_message = (
                f"Multiple students matched admission_number={data.reference!r} "
                f"in school {config.school.code!r}."
            )
            event.processed_at = now()
            event.save()
            logger.error(
                'Payment INVALID_REFERENCE: ref=%s school=%s',
                data.reference,
                config.school.code,
            )
            return event

        event.student = student

        # ── FIFO term selection ────────────────────────────────────────────────
        # Apply payment to the chronologically oldest term with an outstanding
        # closing balance. This prevents mis-allocating historical payments and
        # keeps the ledger consistent (oldest debt settled first).
        # FeeBalance uses the default manager (no SchoolManager) — direct filter.
        oldest_balance = (
            FeeBalance.objects.filter(
                school=config.school,
                student=student,
                closing_balance__gt=Decimal('0.00'),
            )
            .order_by('year', 'term')
            .first()
        )
        if oldest_balance:
            year, term = oldest_balance.year, oldest_balance.term
        else:
            # No outstanding balance — still record payment (credit / advance)
            year = now().year
            term = 1

        # ── Apportion across voteheads by priority ────────────────────────────
        allocations = apportion_payment(config.school, student, data.amount, year=year, term=term)
        serializable_allocations = [
            {'vote_head': item['vote_head'], 'amount': float(item['amount'])}
            for item in allocations
        ]

        # ── Create ledger entry (source of truth) ─────────────────────────────
        # mode='mpesa' for MPESA; mode='bank' for KCB Buni (no new mode needed).
        # Actual provider is preserved in apportion_log for reporting.
        mode = 'mpesa' if data.provider == 'mpesa' else 'bank'
        fee_tx = PaymentTransaction(
            school=config.school,
            student=student,
            amount=data.amount,
            mode=mode,
            transaction_code=data.transaction_code,
            remarks=f'Automated via {data.provider} webhook',
            apportion_log={
                'provider': data.provider,
                'allocations': serializable_allocations,
                'year': year,
                'term': term,
            },
        )
        fee_tx.save()

        # ── Update FeeBalance summary (denormalization cache) ─────────────────
        apply_payment_to_balances(config.school, student, year, term, allocations)

        # ── Finalize PaymentEvent ─────────────────────────────────────────────
        event.payment_transaction = fee_tx
        event.status = 'RECONCILED'
        event.processed_at = now()
        event.save()

        # ── Schedule SMS (fires AFTER this atomic block commits) ──────────────
        # Using transaction.on_commit() ensures SMS is never sent if the
        # transaction rolls back. The call is synchronous but outside the
        # atomic block — no external API latency inside the transaction.
        # Upgrade path: replace with `sms_task.delay(str(event.id))` when
        # Celery is added to the project.
        transaction.on_commit(
            lambda: _send_sms_after_commit(str(event.id))
        )

        logger.info(
            'Payment RECONCILED: provider=%s tx=%s student=%s amount=%s year=%s term=%s',
            data.provider,
            data.transaction_code,
            student.admission_number,
            data.amount,
            year,
            term,
        )
        return event

    @staticmethod
    @transaction.atomic
    def reprocess(event: PaymentEvent) -> PaymentEvent:
        """
        Re-attempt reconciliation for a previously failed event.
        Only UNRESOLVED_STUDENT or INVALID_REFERENCE events may be reprocessed.

        Three idempotency guards prevent double ledger entries:
          1. Status guard  — rejects any non-failed status
          2. FK guard      — rejects if payment_transaction is already linked
          3. DB guard      — rejects if RECONCILED already exists in DB (concurrent reprocess)
        """
        if event.status not in ('UNRESOLVED_STUDENT', 'INVALID_REFERENCE'):
            raise ValueError(
                f'Cannot reprocess event with status={event.status!r}. '
                'Only UNRESOLVED_STUDENT or INVALID_REFERENCE events may be reprocessed.'
            )
        if event.payment_transaction_id is not None:
            raise ValueError(
                f'Event {event.id} already has a linked payment_transaction '
                '— refusing to reprocess to prevent double ledger entry.'
            )
        if PaymentEvent.unscoped.filter(
            idempotency_key=event.idempotency_key,
            status='RECONCILED',
        ).exists():
            raise ValueError(
                f'Event {event.id} was already reconciled concurrently. '
                'Aborting reprocess.'
            )

        event.retry_count += 1
        event.save(update_fields=['retry_count', 'updated_at'])

        config = event.payment_config
        prev_school = _set_school_context(config.school)
        try:
            from apps.students.models import Student

            try:
                student = Student.objects.get(
                    admission_number=event.reference.strip().upper(),
                )
            except Student.DoesNotExist:
                event.status = 'UNRESOLVED_STUDENT'
                event.error_message = (
                    f"No student with admission_number={event.reference!r} "
                    f"in school {config.school.code!r}."
                )
                event.processed_at = now()
                event.save()
                return event
            except Student.MultipleObjectsReturned:
                event.status = 'INVALID_REFERENCE'
                event.error_message = (
                    f"Multiple students matched admission_number={event.reference!r} "
                    f"in school {config.school.code!r}."
                )
                event.processed_at = now()
                event.save()
                return event

            event.student = student

            oldest_balance = (
                FeeBalance.objects.filter(
                    school=config.school,
                    student=student,
                    closing_balance__gt=Decimal('0.00'),
                )
                .order_by('year', 'term')
                .first()
            )
            year = oldest_balance.year if oldest_balance else now().year
            term = oldest_balance.term if oldest_balance else 1

            allocations = apportion_payment(config.school, student, event.amount, year=year, term=term)
            serializable_allocations = [
                {'vote_head': item['vote_head'], 'amount': float(item['amount'])}
                for item in allocations
            ]

            mode = 'mpesa' if event.provider == 'mpesa' else 'bank'
            fee_tx = PaymentTransaction(
                school=config.school,
                student=student,
                amount=event.amount,
                mode=mode,
                transaction_code=event.transaction_code,
                remarks=(
                    f'Reprocessed via {event.provider} webhook '
                    f'(retry #{event.retry_count})'
                ),
                apportion_log={
                    'provider': event.provider,
                    'allocations': serializable_allocations,
                    'year': year,
                    'term': term,
                    'reprocessed': True,
                },
            )
            fee_tx.save()
            apply_payment_to_balances(config.school, student, year, term, allocations)

            event.payment_transaction = fee_tx
            event.status = 'RECONCILED'
            event.processed_at = now()
            event.save()

            transaction.on_commit(
                lambda: _send_sms_after_commit(str(event.id))
            )

            logger.info(
                'Payment REPROCESSED: event=%s tx=%s student=%s retry=%s',
                event.id,
                event.transaction_code,
                student.admission_number,
                event.retry_count,
            )
            return event
        finally:
            _restore_school_context(prev_school)


def _send_sms_after_commit(event_id: str) -> None:
    """
    Thin wrapper called by transaction.on_commit().
    Isolates the import to avoid circular dependencies at module load time.
    """
    from apps.payments.services.sms import PaymentSMSService
    PaymentSMSService.safe_send(event_id)
