import base64
import logging
from decimal import Decimal

import requests
from django.conf import settings

from .base import BasePaymentProvider, PaymentEventData

logger = logging.getLogger(__name__)


class MPESAProvider(BasePaymentProvider):
    """
    Adapter for Safaricom Daraja C2B (Customer to Business) webhooks.

    Daraja sends two types of callbacks:
      - Validation URL:   pre-authorisation check before processing
      - Confirmation URL: final, irrevocable notification

    Students must use their admission_number as the BillRefNumber (account
    reference) when paying via the school's paybill.

    Daraja C2B payload example:
    {
        "TransactionType": "Pay Bill",
        "TransID": "OEI2AK4Q16",
        "TransTime": "20191122063845",
        "TransAmount": "1500.00",
        "BusinessShortCode": "600638",
        "BillRefNumber": "ADM001",
        "MSISDN": "25470****149",
        "FirstName": "John",
        "MiddleName": "",
        "LastName": "Doe"
    }
    """

    PROVIDER_CODE = 'mpesa'

    def normalize(self, payload: dict) -> PaymentEventData:
        return PaymentEventData(
            provider='mpesa',
            transaction_code=str(payload['TransID']).strip(),
            amount=Decimal(str(payload['TransAmount'])),
            phone_number=str(payload.get('MSISDN', '')),
            reference=str(payload.get('BillRefNumber', '')).strip().upper(),
            short_code=str(payload.get('BusinessShortCode', '')).strip(),
            raw_payload=payload,
            payment_time=payload.get('TransTime'),
        )

    def _get_access_token(self, consumer_key: str, consumer_secret: str) -> str:
        """Obtain a short-lived OAuth2 bearer token from Safaricom Daraja."""
        credentials = base64.b64encode(
            f'{consumer_key}:{consumer_secret}'.encode()
        ).decode()
        url = f'{settings.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials'
        response = requests.get(
            url,
            headers={'Authorization': f'Basic {credentials}'},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()['access_token']

    def register_c2b_urls(
        self,
        short_code: str,
        confirmation_url: str,
        validation_url: str,
        consumer_key: str,
        consumer_secret: str,
    ) -> dict:
        """
        Register the confirmation and validation webhook URLs with Safaricom
        for a given paybill short code. Call this once per paybill when setting
        up a new school's payment config, or to update the URLs.

        ResponseType "Completed" means Safaricom will proceed even if our
        validation endpoint is unreachable (safest for production).
        """
        token = self._get_access_token(consumer_key, consumer_secret)
        url = f'{settings.MPESA_BASE_URL}/mpesa/c2b/v1/registerurl'
        payload = {
            'ShortCode': short_code,
            'ResponseType': 'Completed',
            'ConfirmationURL': confirmation_url,
            'ValidationURL': validation_url,
        }
        response = requests.post(
            url,
            json=payload,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            },
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
