import hashlib
import hmac
import logging
from decimal import Decimal

from django.conf import settings

from .base import BasePaymentProvider, PaymentEventData

logger = logging.getLogger(__name__)


class KCBBuniProvider(BasePaymentProvider):
    """
    Adapter for KCB Buni (KCB merchant payment gateway) webhooks.

    KCB Buni sends a signed HTTP POST to the registered webhook URL when a
    customer makes a payment referencing the school's merchant code.
    Students use their admission_number as the accountReference.

    Signature verification uses HMAC-SHA256 over the raw request body bytes
    (NOT re-serialised JSON — key ordering is not guaranteed).
    The signature is sent in the X-KCB-Signature header as a hex digest.

    KCB Buni webhook payload example:
    {
        "transactionId": "KCB20240115123456",
        "amount": 1500.00,
        "phoneNumber": "254712345678",
        "accountReference": "ADM001",
        "merchantCode": "12345",
        "transactionDate": "2024-01-15T10:30:00",
        "status": "SUCCESS",
        "currency": "KES"
    }
    """

    PROVIDER_CODE = 'kcb_buni'

    def normalize(self, payload: dict) -> PaymentEventData:
        return PaymentEventData(
            provider='kcb_buni',
            transaction_code=str(payload['transactionId']).strip(),
            amount=Decimal(str(payload['amount'])),
            phone_number=str(payload.get('phoneNumber', '')),
            reference=str(payload.get('accountReference', '')).strip().upper(),
            short_code=str(payload.get('merchantCode', '')).strip(),
            raw_payload=payload,
            payment_time=payload.get('transactionDate'),
        )

    def validate_signature(self, raw_body: bytes, signature: str) -> bool:
        """
        Verify the HMAC-SHA256 signature of the raw request body.

        CRITICAL: raw_body must be the original request.body bytes — never
        re-serialise the parsed JSON dict, as key ordering is not guaranteed
        and will produce a different digest.

        Returns False (and logs a warning) if KCB_BUNI_WEBHOOK_SECRET is
        not configured, so mis-configured environments fail closed.
        """
        secret = getattr(settings, 'KCB_BUNI_WEBHOOK_SECRET', '')
        if not secret:
            logger.warning(
                'KCB_BUNI_WEBHOOK_SECRET is not configured — '
                'rejecting all KCB Buni webhook requests.'
            )
            return False

        computed = hmac.new(
            secret.encode('utf-8'),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed, signature)
