import abc
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional


@dataclass
class PaymentEventData:
    """
    Normalised, provider-agnostic representation of a single inbound payment.
    Produced by every provider's normalize() method.
    """
    provider: str           # 'mpesa' or 'kcb_buni'
    transaction_code: str   # Provider's unique transaction reference
    amount: Decimal         # Payment amount
    phone_number: str       # Sender phone (may be masked)
    reference: str          # Account reference entered by payer (= admission_number)
    short_code: str         # Paybill / merchant code — used for school routing
    raw_payload: dict       # Original webhook body (stored verbatim for audit)
    payment_time: Optional[str] = None  # Provider's transaction timestamp string


class BasePaymentProvider(abc.ABC):
    """Abstract base for all payment provider adapters."""

    PROVIDER_CODE: str = ''

    @abc.abstractmethod
    def normalize(self, payload: dict) -> PaymentEventData:
        """Convert a raw webhook payload dict to a unified PaymentEventData."""
        ...

    def validate_shortcode(self, short_code: str) -> bool:
        """
        Check that the given short_code maps to an active SchoolPaymentConfig.
        Used by MPESA validation endpoint (lightweight, single DB query).
        """
        from apps.payments.models import SchoolPaymentConfig
        return SchoolPaymentConfig.objects.filter(
            provider=self.PROVIDER_CODE,
            short_code=short_code,
            is_active=True,
        ).exists()
