from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet, ItemCategoryViewSet, ItemViewSet, 
    LPOViewSet, StockTransactionViewSet,PaymentVoucherViewSet,
    PettyCashTransactionViewSet, FeesInKindTransactionViewSet,SupplierLedgerAPIView,StockIssuanceAPIView,StockBalanceAPIView,
    StoreMovementReportAPIView,LPORegisterAPIView,PaymentVoucherRegisterAPIView,PettyCashRegisterAPIView
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'categories', ItemCategoryViewSet)
router.register(r'items', ItemViewSet)
router.register(r'lpos', LPOViewSet)
router.register(r'stock-transactions', StockTransactionViewSet)
router.register(r'payment-vouchers', PaymentVoucherViewSet)
router.register(r'petty-cash-transactions', PettyCashTransactionViewSet)
router.register(r'fees-in-kind-transactions', FeesInKindTransactionViewSet)

urlpatterns = router.urls

urlpatterns += [
    path('supplier-ledger/<int:supplier_id>/', SupplierLedgerAPIView.as_view(), name='supplier-ledger'),
    path('issue-stock/', StockIssuanceAPIView.as_view(), name='issue-stock'),
    path('stock-balance/<int:item_id>/', StockBalanceAPIView.as_view(), name='stock-balance'),
    path('store-movement-report/', StoreMovementReportAPIView.as_view(), name='store-movement-report'),
    path('lpo-register/', LPORegisterAPIView.as_view(), name='lpo-register'),
    path('payment-voucher-register/', PaymentVoucherRegisterAPIView.as_view(), name='payment-voucher-register'),
    path('petty-cash-register/', PettyCashRegisterAPIView.as_view(), name='petty-cash-register'),
]