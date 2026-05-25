import json
import logging

from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from apps.payments.models import SchoolPaymentConfig
from apps.payments.providers.kcb import KCBBuniProvider
from apps.payments.providers.mpesa import MPESAProvider
from apps.payments.services.processor import PaymentProcessor, PaymentRoutingError

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class MPESAValidationView(View):
    """
    Safaricom Daraja C2B validation URL.

    Called by Safaricom BEFORE processing a transaction, giving us a chance
    to accept or reject it. Safaricom requires a response within 5 seconds.

    IMPORTANT performance contract:
      - Zero logging (no I/O on the hot path)
      - Exactly one DB query (.exists())
      - No record creation
      - No serializers
    If Safaricom receives a non-200 HTTP response or no response, it falls
    back to the ResponseType registered (we use "Completed" which auto-accepts).
    """

    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body)
            short_code = str(payload.get('BusinessShortCode', '')).strip()
        except (json.JSONDecodeError, KeyError, ValueError):
            return JsonResponse(
                {'ResultCode': 'C2B00016', 'ResultDesc': 'Rejected'},
                status=200,  # Always 200 — Safaricom ignores non-200
            )

        exists = SchoolPaymentConfig.objects.filter(
            provider='mpesa',
            short_code=short_code,
            is_active=True,
        ).exists()

        if not exists:
            return JsonResponse(
                {'ResultCode': 'C2B00011', 'ResultDesc': 'Invalid Account Number'},
                status=200,
            )

        return JsonResponse(
            {'ResultCode': '0', 'ResultDesc': 'Accepted'},
            status=200,
        )


@method_decorator(csrf_exempt, name='dispatch')
class MPESAConfirmationView(View):
    """
    Safaricom Daraja C2B confirmation URL.

    Called AFTER a transaction is completed. This is the final, irrevocable
    notification — the payment has already been debited from the customer.

    We MUST return {"ResultCode": "0"} regardless of internal errors.
    If Safaricom receives a non-200 or non-zero ResultCode, it retries
    indefinitely — this would produce duplicate PaymentTransaction records
    without our idempotency guard. The guard lives in PaymentProcessor.
    """

    def post(self, request, *args, **kwargs):
        raw_body = request.body
        source_ip = request.META.get('REMOTE_ADDR')

        try:
            payload = json.loads(raw_body)
            data = MPESAProvider().normalize(payload)
            PaymentProcessor.handle(data, source_ip=source_ip)
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.error('MPESA confirmation: malformed payload: %s', exc)
        except PaymentRoutingError as exc:
            logger.error('MPESA confirmation: routing error: %s', exc)
        except Exception as exc:
            logger.exception('MPESA confirmation: unexpected error: %s', exc)

        # Always return success — see docstring above.
        return JsonResponse(
            {'ResultCode': '0', 'ResultDesc': 'Success'},
            status=200,
        )


@method_decorator(csrf_exempt, name='dispatch')
class KCBBuniWebhookView(View):
    """
    KCB Buni payment notification endpoint.

    Signature verification is the FIRST action — raw bytes must be captured
    before any JSON parsing (re-serialisation changes byte order and breaks HMAC).

    Unlike MPESA, KCB Buni supports proper HTTP error responses, so we
    return 4xx/5xx codes where appropriate (except for internal processing
    errors which should not cause retries of already-applied payments).
    """

    def post(self, request, *args, **kwargs):
        # Capture raw body bytes FIRST — before any parsing.
        # HMAC must be computed over the original bytes, not re-serialised JSON.
        raw_body = request.body
        signature = request.headers.get('X-KCB-Signature', '')
        source_ip = request.META.get('REMOTE_ADDR')
        provider = KCBBuniProvider()

        # ── Signature verification ─────────────────────────────────────────────
        if not provider.validate_signature(raw_body, signature):
            logger.warning(
                'KCB Buni: invalid signature from ip=%s signature=%r',
                source_ip,
                signature[:16] + '...' if len(signature) > 16 else signature,
            )
            return JsonResponse({'error': 'Invalid signature'}, status=401)

        # ── Process payment ───────────────────────────────────────────────────
        try:
            payload = json.loads(raw_body)
            data = provider.normalize(payload)
            PaymentProcessor.handle(data, source_ip=source_ip)
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.error('KCB Buni: malformed payload from ip=%s: %s', source_ip, exc)
            return JsonResponse({'error': 'Malformed payload'}, status=400)
        except PaymentRoutingError as exc:
            logger.error(
                'KCB Buni: routing error from ip=%s: %s', source_ip, exc
            )
            return JsonResponse({'error': 'Unknown merchant code'}, status=404)
        except Exception as exc:
            logger.exception(
                'KCB Buni: unexpected error from ip=%s: %s', source_ip, exc
            )
            return JsonResponse({'error': 'Internal server error'}, status=500)

        return JsonResponse({'status': 'success'}, status=200)
