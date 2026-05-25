from django.urls import path
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAdminUser

from .models import PaymentEvent
from .serializers import PaymentEventSerializer
from .webhooks.views import (
    KCBBuniWebhookView,
    MPESAConfirmationView,
    MPESAValidationView,
)


class PaymentEventListView(ListAPIView):
    serializer_class = PaymentEventSerializer
    permission_classes = [IsAdminUser]
    # Unscoped: admin API shows all schools' events (RBAC enforced by IsAdminUser)
    queryset = PaymentEvent.unscoped.all().order_by('-created_at')


class PaymentEventDetailView(RetrieveAPIView):
    serializer_class = PaymentEventSerializer
    permission_classes = [IsAdminUser]
    queryset = PaymentEvent.unscoped.all()


urlpatterns = [
    # ── Safaricom Daraja C2B webhooks ──────────────────────────────────────────
    path(
        'webhooks/mpesa/validate/',
        MPESAValidationView.as_view(),
        name='mpesa-validate',
    ),
    path(
        'webhooks/mpesa/confirm/',
        MPESAConfirmationView.as_view(),
        name='mpesa-confirm',
    ),
    # ── KCB Buni webhook ───────────────────────────────────────────────────────
    path(
        'webhooks/kcb-buni/',
        KCBBuniWebhookView.as_view(),
        name='kcb-buni-webhook',
    ),
    # ── Admin / reporting API ──────────────────────────────────────────────────
    path('events/', PaymentEventListView.as_view(), name='payment-events'),
    path(
        'events/<uuid:pk>/',
        PaymentEventDetailView.as_view(),
        name='payment-event-detail',
    ),
]
