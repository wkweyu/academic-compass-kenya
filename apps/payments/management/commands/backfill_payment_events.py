"""
Management command: backfill_payment_events

Creates PaymentIngressLog + PaymentEvent(RECONCILED) for every
fees.PaymentTransaction that has no linked PaymentEvent. This populates
the unified payment ledger for historical payments that were entered via
the old Supabase-direct path, making them visible in the Payments dashboard
and feed without re-running fee allocation.

Usage:
    python manage.py backfill_payment_events
    python manage.py backfill_payment_events --dry-run
"""
import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import now

from apps.fees.models import PaymentTransaction
from apps.payments.models import PaymentEvent, PaymentIngressLog, SchoolPaymentConfig

logger = logging.getLogger(__name__)

PAYMENT_SYSTEM_VERSION = '1.0.0'

# Map fees PaymentTransaction.mode → PaymentEvent.provider
_MODE_TO_PROVIDER = {
    'mpesa': 'mpesa',
    'bank': 'manual',
    'cash': 'manual',
    'cheque': 'manual',
    'fees_in_kind': 'manual',
}


class Command(BaseCommand):
    help = (
        'Backfill PaymentEvent rows for historical PaymentTransaction records '
        'that have no linked PaymentEvent (entered via legacy Supabase-direct path).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be created without writing anything.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no data will be written.'))

        # PaymentTransaction rows with no linked PaymentEvent
        qs = (
            PaymentTransaction.objects
            .select_related('student', 'school')
            .filter(payment_event__isnull=True)
            .order_by('school_id', 'date')
        )

        total = qs.count()
        self.stdout.write(f'Found {total} PaymentTransaction(s) with no linked PaymentEvent.')

        created = skipped_blank = skipped_config = skipped_duplicate = errors = 0

        for tx in qs:
            school = tx.school
            student = tx.student

            # Skip rows with no transaction code — can't build a stable key
            if not tx.transaction_code:
                skipped_blank += 1
                continue

            # Include tx.id in the key to handle duplicate transaction_code values
            idempotency_key = f'manual:{school.code}:{tx.transaction_code.upper()}:{tx.id}'

            # Hard duplicate guard
            if PaymentEvent.unscoped.filter(idempotency_key=idempotency_key).exists():
                skipped_duplicate += 1
                continue

            # Look up the manual SchoolPaymentConfig (seeded by seed_manual_payment_configs)
            try:
                config = SchoolPaymentConfig.objects.get(provider='manual', school=school)
            except SchoolPaymentConfig.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f'  SKIP tx.id={tx.id}: no manual SchoolPaymentConfig for school {school.code}. '
                        f'Run seed_manual_payment_configs first.'
                    )
                )
                skipped_config += 1
                continue

            provider = _MODE_TO_PROVIDER.get(tx.mode, 'manual')

            if dry_run:
                self.stdout.write(
                    f'  WOULD CREATE: school={school.code} student={student.admission_number} '
                    f'amount={tx.amount} mode={tx.mode} key={idempotency_key}'
                )
                created += 1
                continue

            try:
                with transaction.atomic():
                    ingress_log = PaymentIngressLog.objects.create(
                        provider=provider,
                        short_code=config.short_code,
                        raw_payload={
                            'source': 'backfill',
                            'payment_transaction_id': tx.id,
                            'admission_number': student.admission_number,
                            'amount': str(tx.amount),
                            'mode': tx.mode,
                            'transaction_code': tx.transaction_code,
                            'date': tx.date.isoformat(),
                            'remarks': tx.remarks,
                        },
                        source_ip=None,
                        resolved_school=school,
                    )

                    # Derive apportion_log entries for the event
                    apportion = tx.apportion_log or {}
                    allocations_raw = apportion.get('allocations', [])

                    event = PaymentEvent(
                        school=school,
                        ingress_log=ingress_log,
                        idempotency_key=idempotency_key,
                        provider=provider,
                        transaction_code=tx.transaction_code.upper(),
                        amount=tx.amount,
                        phone_number='',
                        reference=student.admission_number,
                        payment_config=config,
                        student=student,
                        payment_transaction=tx,
                        status='RECONCILED',
                        processed_at=tx.date,
                        sms_status='SKIPPED',
                        system_version=PAYMENT_SYSTEM_VERSION,
                    )
                    event.save()
                    created += 1

            except Exception as exc:
                errors += 1
                logger.exception('backfill_payment_events: error for tx.id=%s', tx.id)
                self.stdout.write(
                    self.style.ERROR(f'  ERROR tx.id={tx.id}: {exc}')
                )

        self.stdout.write('')
        verb = 'Would create' if dry_run else 'Created'
        self.stdout.write(self.style.SUCCESS(
            f'{verb}: {created} | '
            f'Skipped blank code: {skipped_blank} | '
            f'Skipped duplicate: {skipped_duplicate} | '
            f'Skipped missing config: {skipped_config} | '
            f'Errors: {errors}'
        ))
