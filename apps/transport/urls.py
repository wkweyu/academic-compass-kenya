from django.urls import path
from .views import TransportReceiptView, TransportChargeReportView, TransportRouteViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'routes', TransportRouteViewSet)

urlpatterns = router.urls + [
    path('charges-report/', TransportChargeReportView.as_view(), name='transport-charges-report'),
    path('receipt/<int:payment_id>/', TransportReceiptView.as_view(), name='transport-receipt'),
]
