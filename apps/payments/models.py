import uuid

from django.db import models

from apps.core.models import SchoolScopedModel


PROVIDER_CHOICES = [
    ('mpesa', 'M-PESA Paybill'),
    ('kcb_buni', 'KCB Buni'),
    ('manual', 'Manual Entry'),
]

PAYMENT_EVENT_STATUS = [
    ('RECEIVED', 'Received'),
    ('DUPLICATE', 'Duplicate'),
    ('INVALID_REFERENCE', 'Invalid Reference'),
    ('UNRESOLVED_STUDENT', 'Unresolved Student'),
    ('RECONCILED', 'Reconciled'),
]

SMS_DELIVERY_STATUS = [
    ('PENDING', 'Pending'),
    ('SENT', 'Sent'),
    ('FAILED', 'Failed'),
    ('SKIPPED', 'Skipped'),
]


class PaymentIngressLog(models.Model):
    """
    Immutable raw webhook audit log. Written on every inbound webhook hit,
    even for duplicates. Never deleted. No unique constraint on transaction
    identifiers — provider retries are expected and all should be logged.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, db_index=True)
    short_code = models.CharField(
        max_length=50,
        help_text='Paybill or merchant code extracted from the raw payload.',
    )
    raw_payload = models.JSONField(help_text='Full original webhook body.')
    source_ip = models.GenericIPAddressField(
        null=True, blank=True,
        help_text='IP address of the inbound request.',
    )
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_school = models.ForeignKey(
        'schools.School',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ingress_logs',
        help_text=(
            'Set by PaymentProcessor after routing to the correct school. '
            'NULL = routing failed or not yet resolved. '
            'Filter resolved_school__isnull=True to find unresolved ingestions.'
        ),
    )

    class Meta:
        ordering = ['-received_at']
        verbose_name = 'Payment Ingress Log'
        verbose_name_plural = 'Payment Ingress Logs'

    def __str__(self):
        return f'{self.provider} | {self.short_code} | {self.received_at:%Y-%m-%d %H:%M:%S}'


class SchoolPaymentConfig(models.Model):
    """
    Maps a provider paybill / merchant code to a school.
    short_code is globally unique per provider — a paybill cannot belong
    to more than one school. This is used to route inbound webhooks.

    Intentionally NOT a SchoolScopedModel so it can be queried freely
    in webhook context where no school middleware is active.
    """
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='payment_configs',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, db_index=True)
    short_code = models.CharField(
        max_length=50,
        help_text='Paybill number (MPESA) or merchant code (KCB Buni).',
    )
    account_name = models.CharField(
        max_length=100,
        help_text='Display name, e.g. "ABC Academy Fees".',
    )
    is_active = models.BooleanField(default=True, db_index=True)

    # School-level SMS configuration (mirrors attendance SMS pattern)
    sms_enabled = models.BooleanField(default=True)
    sms_api_url = models.CharField(
        max_length=500, blank=True,
        help_text='School-specific SMS provider HTTP endpoint. Leave blank to use system Twilio.',
    )
    sms_api_key = models.CharField(max_length=500, blank=True)
    sms_sender_id = models.CharField(max_length=64, blank=True)

    # Reserved for future provider-specific extras
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = [('provider', 'short_code')]
        verbose_name = 'School Payment Config'
        verbose_name_plural = 'School Payment Configs'

    def __str__(self):
        return f'{self.school.name} | {self.get_provider_display()} | {self.short_code}'


class PaymentEvent(SchoolScopedModel):
    """
    Processing state machine for a single inbound payment notification.
    Created after PaymentIngressLog. Drives reconciliation.
    idempotency_key is the global dedup key: f"{provider}:{transaction_code}".
    """

    # Additional unscoped manager for processor-level queries where no
    # school middleware context exists (idempotency checks, reprocess lookups).
    unscoped = models.Manager()

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    ingress_log = models.OneToOneField(
        PaymentIngressLog,
        on_delete=models.PROTECT,
        related_name='payment_event',
        help_text='Link back to the raw webhook log.',
    )
    idempotency_key = models.CharField(
        max_length=200,
        unique=True,
        db_index=True,
        help_text='Format: "{provider}:{transaction_code}". Global dedup key.',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, db_index=True)
    transaction_code = models.CharField(
        max_length=100,
        help_text='Transaction reference from the payment provider.',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(
        max_length=20, blank=True,
        help_text='Sender phone number (may be masked by provider).',
    )
    reference = models.CharField(
        max_length=100,
        help_text='Account reference entered by payer, normalised to UPPER. Should equal admission_number.',
    )

    payment_config = models.ForeignKey(
        SchoolPaymentConfig,
        on_delete=models.PROTECT,
        related_name='payment_events',
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_events',
        help_text='Resolved by reconciliation. NULL if UNRESOLVED_STUDENT or INVALID_REFERENCE.',
    )

    status = models.CharField(
        max_length=30,
        choices=PAYMENT_EVENT_STATUS,
        default='RECEIVED',
        db_index=True,
    )
    error_message = models.TextField(
        blank=True,
        help_text='Human-readable error detail for non-RECONCILED statuses.',
    )

    payment_transaction = models.OneToOneField(
        'fees.PaymentTransaction',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payment_event',
        help_text='Linked fees ledger entry after successful reconciliation.',
    )

    # Audit trail
    retry_count = models.PositiveSmallIntegerField(default=0)
    processed_at = models.DateTimeField(null=True, blank=True)
    sms_status = models.CharField(max_length=12, choices=SMS_DELIVERY_STATUS, default='PENDING', db_index=True)
    sms_sent_at = models.DateTimeField(null=True, blank=True)
    system_version = models.CharField(max_length=20, default='1.0.0')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Payment Event'
        verbose_name_plural = 'Payment Events'

    def __str__(self):
        return (
            f'{self.get_provider_display()} | {self.transaction_code} | '
            f'{self.amount} | {self.status}'
        )
