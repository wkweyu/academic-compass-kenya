import logging

from django.db import IntegrityError

from apps.payments.models import PaymentIngressLog, PaymentEvent, SchoolPaymentConfig
from apps.payments.providers.base import PaymentEventData

logger = logging.getLogger(__name__)


class PaymentRoutingError(Exception):
    """Raised when no active SchoolPaymentConfig matches the inbound provider + short_code."""


class PaymentProcessor:
    """
    Orchestration layer between webhook views and ReconciliationService.

    Responsibilities (in order, intentionally NOT wrapped in a single transaction):
      1. Idempotency pre-check  — soft guard before any writes
      2. PaymentIngressLog      — always written, even for duplicates
      3. School routing         — maps short_code → SchoolPaymentConfig → school
      4. ReconciliationService  — atomic ledger reconciliation
    """

    @staticmethod
    def handle(data: PaymentEventData, source_ip: str = None) -> PaymentEvent:
        idempotency_key = f'{data.provider}:{data.transaction_code}'

        # ── Step 1: Soft idempotency pre-check ────────────────────────────────
        # Read-only. If we already have a PaymentEvent for this key, skip
        # reconciliation entirely. The DB unique constraint on idempotency_key
        # remains the hard, race-condition-proof guardrail (see step 4).
        existing = PaymentEvent.unscoped.filter(
            idempotency_key=idempotency_key
        ).first()

        # ── Step 2: Always log every raw webhook hit ───────────────────────────
        # Committed immediately in its own implicit transaction.
        # Survives any failure in reconciliation.
        # Multiple ingress logs per transaction_code are valid — provider
        # retries are real and all should appear in the audit trail.
        ingress_log = PaymentIngressLog.objects.create(
            provider=data.provider,
            short_code=data.short_code,
            raw_payload=data.raw_payload,
            source_ip=source_ip,
        )

        if existing is not None:
            logger.info(
                'Payment duplicate detected: idempotency_key=%s existing_status=%s',
                idempotency_key,
                existing.status,
            )
            return existing

        # ── Step 3: Route to school ────────────────────────────────────────────
        try:
            config = SchoolPaymentConfig.objects.get(
                provider=data.provider,
                short_code=data.short_code,
                is_active=True,
            )
        except SchoolPaymentConfig.DoesNotExist:
            logger.error(
                'No active SchoolPaymentConfig: provider=%s short_code=%s',
                data.provider,
                data.short_code,
            )
            raise PaymentRoutingError(
                f'Unknown payment route: provider={data.provider!r} '
                f'short_code={data.short_code!r}'
            )

        # Mark ingress log as resolved (best-effort update — non-critical)
        ingress_log.resolved_school = config.school
        ingress_log.save(update_fields=['resolved_school'])

        # ── Step 4: Reconcile (atomic) ─────────────────────────────────────────
        # Lazy import to avoid circular imports at module load time.
        from apps.payments.services.reconciliation import ReconciliationService
        try:
            event = ReconciliationService.reconcile(data, config, ingress_log)
        except IntegrityError:
            # Race condition: two requests passed the soft pre-check simultaneously.
            # The DB unique constraint on idempotency_key rejected the second INSERT.
            # Fetch and return the winner.
            logger.warning(
                'Race condition on idempotency_key=%s — fetching existing event.',
                idempotency_key,
            )
            event = PaymentEvent.unscoped.get(idempotency_key=idempotency_key)

        return event
