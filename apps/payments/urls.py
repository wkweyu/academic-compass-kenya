from django.urls import path
from .views import (
    DailyCollectionsReportView,
    ManualPaymentView,
    PaymentReportsExportCSVView,
    PaymentDashboardView,
    PaymentEventDetailView,
    PaymentEventListView,
    ProviderCollectionsReportView,
    ReprocessPaymentEventView,
    UnresolvedPaymentEventListView,
    VoteheadCollectionsReportView,
)
from .webhooks.views import (
    KCBBuniWebhookView,
    MPESAConfirmationView,
    MPESAValidationView,
)


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
        'manual/',
        ManualPaymentView.as_view(),
        name='manual-payment',
    ),
    path(
        'events/unresolved/',
        UnresolvedPaymentEventListView.as_view(),
        name='payment-events-unresolved',
    ),
    path(
        'events/<uuid:pk>/reprocess/',
        ReprocessPaymentEventView.as_view(),
        name='payment-event-reprocess',
    ),
    path(
        'events/<uuid:pk>/',
        PaymentEventDetailView.as_view(),
        name='payment-event-detail',
    ),
    path(
        'dashboard/',
        PaymentDashboardView.as_view(),
        name='payment-dashboard',
    ),
    path(
        'reports/daily/',
        DailyCollectionsReportView.as_view(),
        name='payment-reports-daily',
    ),
    path(
        'reports/providers/',
        ProviderCollectionsReportView.as_view(),
        name='payment-reports-providers',
    ),
    path(
        'reports/voteheads/',
        VoteheadCollectionsReportView.as_view(),
        name='payment-reports-voteheads',
    ),
    path(
        'reports/export/',
        PaymentReportsExportCSVView.as_view(),
        name='payment-reports-export-csv',
    ),
]
