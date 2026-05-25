import logging

from django.contrib import admin, messages
from django.conf import settings

from apps.payments.models import PaymentEvent, PaymentIngressLog, SchoolPaymentConfig
from apps.payments.providers.mpesa import MPESAProvider

logger = logging.getLogger(__name__)


@admin.register(PaymentIngressLog)
class PaymentIngressLogAdmin(admin.ModelAdmin):
    """
    Read-only audit log of every raw webhook hit.
    Ops teams can filter for unresolved_school__isnull=True to identify
    webhooks from unconfigured paybills (i.e. routing failures).
    """
    list_display = [
        'received_at', 'provider', 'short_code', 'resolved_school',
        'source_ip',
    ]
    list_filter = [
        'provider',
        ('resolved_school', admin.EmptyFieldListFilter),  # "Has resolved school" / "No resolved school"
    ]
    search_fields = ['short_code', 'source_ip']
    readonly_fields = [
        'id', 'provider', 'short_code', 'raw_payload', 'source_ip',
        'received_at', 'resolved_school',
    ]
    ordering = ['-received_at']
    date_hierarchy = 'received_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SchoolPaymentConfig)
class SchoolPaymentConfigAdmin(admin.ModelAdmin):
    list_display = [
        'school', 'provider', 'short_code', 'account_name', 'is_active', 'sms_enabled',
    ]
    list_filter = ['provider', 'is_active', 'sms_enabled', 'school']
    search_fields = ['short_code', 'account_name', 'school__name']
    actions = ['register_mpesa_c2b_urls']

    def register_mpesa_c2b_urls(self, request, queryset):
        """
        Register / update the C2B validation and confirmation URLs with
        Safaricom Daraja for the selected MPESA paybill configs.

        Requires BASE_URL, MPESA_CONSUMER_KEY, and MPESA_CONSUMER_SECRET
        to be set in Django settings.
        """
        base_url = getattr(settings, 'BASE_URL', '').rstrip('/')
        consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')

        if not all([base_url, consumer_key, consumer_secret]):
            self.message_user(
                request,
                'BASE_URL, MPESA_CONSUMER_KEY, or MPESA_CONSUMER_SECRET is not '
                'configured in settings. Cannot register URLs.',
                level=messages.ERROR,
            )
            return

        provider = MPESAProvider()
        success_count = 0
        for config in queryset.filter(provider='mpesa', is_active=True):
            confirmation_url = f'{base_url}/api/payments/webhooks/mpesa/confirm/'
            validation_url = f'{base_url}/api/payments/webhooks/mpesa/validate/'
            try:
                result = provider.register_c2b_urls(
                    short_code=config.short_code,
                    confirmation_url=confirmation_url,
                    validation_url=validation_url,
                    consumer_key=consumer_key,
                    consumer_secret=consumer_secret,
                )
                logger.info(
                    'MPESA C2B URL registration: short_code=%s result=%s',
                    config.short_code,
                    result,
                )
                success_count += 1
            except Exception as exc:
                logger.error(
                    'MPESA C2B URL registration failed: short_code=%s error=%s',
                    config.short_code,
                    exc,
                )
                self.message_user(
                    request,
                    f'Failed to register URLs for {config.school.name} '
                    f'({config.short_code}): {exc}',
                    level=messages.ERROR,
                )

        if success_count:
            self.message_user(
                request,
                f'Successfully registered C2B URLs for {success_count} paybill(s).',
                level=messages.SUCCESS,
            )

    register_mpesa_c2b_urls.short_description = 'Register MPESA C2B URLs with Safaricom Daraja'


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    """
    All fields are read-only — the payment ledger is append-only.
    Operators may use the reprocess_events action to retry failed events.
    """
    list_display = [
        'created_at', 'school', 'provider', 'transaction_code', 'amount',
        'reference', 'student', 'status', 'retry_count', 'processed_at',
    ]
    list_filter = ['status', 'provider', 'school']
    search_fields = [
        'transaction_code', 'reference', 'idempotency_key',
        'student__admission_number', 'student__full_name',
    ]
    readonly_fields = [
        'id', 'school', 'ingress_log', 'idempotency_key', 'provider',
        'transaction_code', 'amount', 'phone_number', 'reference',
        'payment_config', 'student', 'status', 'error_message',
        'payment_transaction', 'retry_count', 'processed_at',
        'system_version', 'created_at', 'updated_at',
    ]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    actions = ['reprocess_events']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def reprocess_events(self, request, queryset):
        """
        Re-attempt reconciliation for selected UNRESOLVED_STUDENT or
        INVALID_REFERENCE events. Typical use case: admin adds the student
        record or fixes an admission_number typo, then re-runs this action
        to recover the payment.

        Silently skips already-RECONCILED events.
        """
        from apps.payments.services.reconciliation import ReconciliationService

        reprocessable = queryset.filter(
            status__in=['UNRESOLVED_STUDENT', 'INVALID_REFERENCE'],
            payment_transaction__isnull=True,
        )
        if not reprocessable.exists():
            self.message_user(
                request,
                'No reprocessable events selected. Only UNRESOLVED_STUDENT or '
                'INVALID_REFERENCE events without an existing payment transaction '
                'can be reprocessed.',
                level=messages.WARNING,
            )
            return

        reconciled_count = 0
        failed_count = 0
        for event in reprocessable.select_related('payment_config', 'school'):
            try:
                result = ReconciliationService.reprocess(event)
                if result.status == 'RECONCILED':
                    reconciled_count += 1
                else:
                    failed_count += 1
            except ValueError as exc:
                logger.warning(
                    'Reprocess rejected for event=%s: %s', event.id, exc
                )
                failed_count += 1
            except Exception as exc:
                logger.exception(
                    'Reprocess error for event=%s: %s', event.id, exc
                )
                failed_count += 1

        summary_parts = []
        if reconciled_count:
            summary_parts.append(f'{reconciled_count} event(s) reconciled successfully.')
        if failed_count:
            summary_parts.append(
                f'{failed_count} event(s) still failed — check server logs for details.'
            )
        level = messages.SUCCESS if not failed_count else messages.WARNING
        self.message_user(request, ' '.join(summary_parts), level=level)

    reprocess_events.short_description = (
        'Reprocess failed payments (UNRESOLVED_STUDENT / INVALID_REFERENCE)'
    )
