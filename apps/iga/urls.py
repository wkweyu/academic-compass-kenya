from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityBudgetViewSet,
    ActivityExpenseViewSet,
    ActivityProfitabilityReportAPIView,
    ActivityViewSet,
    AdjustInventoryAPIView,
    BudgetVsActualReportAPIView,
    IGAOverviewReportAPIView,
    IncomeExpenditureReportAPIView,
    InventoryMovementViewSet,
    InventoryReportAPIView,
    InventoryStockViewSet,
    ProductViewSet,
    ProduceSaleViewSet,
    ProductionRecordViewSet,
    ProductionReportAPIView,
    RecordInternalConsumptionAPIView,
    RecordSpoilageAPIView,
)

router = DefaultRouter()
router.register(r'activities', ActivityViewSet, basename='iga-activity')
router.register(r'products', ProductViewSet, basename='iga-product')
router.register(r'production', ProductionRecordViewSet, basename='iga-production')
router.register(r'inventory', InventoryStockViewSet, basename='iga-inventory')
router.register(r'inventory-movements', InventoryMovementViewSet, basename='iga-inventory-movement')
router.register(r'sales', ProduceSaleViewSet, basename='iga-sale')
router.register(r'expenses', ActivityExpenseViewSet, basename='iga-expense')
router.register(r'budgets', ActivityBudgetViewSet, basename='iga-budget')

urlpatterns = [
    path('inventory/spoilage/', RecordSpoilageAPIView.as_view(), name='iga-record-spoilage'),
    path('inventory/internal-use/', RecordInternalConsumptionAPIView.as_view(), name='iga-record-internal-use'),
    path('inventory/adjust/', AdjustInventoryAPIView.as_view(), name='iga-adjust-inventory'),
    path('reports/', IGAOverviewReportAPIView.as_view(), name='iga-reports-overview'),
    path('reports/profitability/', ActivityProfitabilityReportAPIView.as_view(), name='iga-profitability-report'),
    path('reports/production/', ProductionReportAPIView.as_view(), name='iga-production-report'),
    path('reports/inventory/', InventoryReportAPIView.as_view(), name='iga-inventory-report'),
    path('reports/income-vs-expenditure/', IncomeExpenditureReportAPIView.as_view(), name='iga-income-vs-expenditure-report'),
    path('reports/budget-vs-actual/', BudgetVsActualReportAPIView.as_view(), name='iga-budget-vs-actual-report'),
] + router.urls
