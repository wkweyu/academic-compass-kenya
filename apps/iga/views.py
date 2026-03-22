from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSchoolUser

from .models import Activity, ActivityBudget, ActivityExpense, InventoryMovement, InventoryStock, Product, ProduceSale, ProductionRecord
from .reports import (
    get_activity_profitability_report,
    get_budget_vs_actual_report,
    get_iga_overview_report,
    get_income_vs_expenditure_report,
    get_inventory_report,
    get_production_report,
)
from .permissions import (
    EXPENSE_APPROVAL_ROLES,
    EXPENSE_ENTRY_ROLES,
    INVENTORY_CONTROL_ROLES,
    PRODUCTION_ENTRY_ROLES,
    SALES_ENTRY_ROLES,
    assert_iga_role,
)
from .serializers import (
    ActivityBudgetSerializer,
    ActivityExpenseSerializer,
    ActivitySerializer,
    ExpenseDecisionSerializer,
    InventoryActionSerializer,
    InventoryAdjustmentSerializer,
    InventoryMovementSerializer,
    InventoryStockSerializer,
    ProductSerializer,
    ProduceSaleSerializer,
    ProductionRecordSerializer,
    execute_adjustment_action,
    execute_approval,
    execute_internal_use_action,
    execute_rejection,
    execute_spoilage_action,
)


class SchoolScopedViewMixin:
    permission_classes = [IsAuthenticated, IsSchoolUser]
    model = None
    select_related = ()

    def get_school(self):
        return self.request.user.school

    def get_queryset(self):
        queryset = self.model.objects.filter(school=self.get_school())
        if self.select_related:
            queryset = queryset.select_related(*self.select_related)
        return queryset

    def perform_create(self, serializer):
        serializer.save(school=self.get_school())


class ActivityViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = Activity
    serializer_class = ActivitySerializer
    select_related = ('manager', 'school')


class ProductViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = Product
    serializer_class = ProductSerializer
    select_related = ('school',)


class ProductionRecordViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = ProductionRecord
    serializer_class = ProductionRecordSerializer
    select_related = ('activity', 'product', 'recorded_by', 'school')
    http_method_names = ['get', 'post', 'head', 'options']

    def perform_create(self, serializer):
        assert_iga_role(self.request.user, PRODUCTION_ENTRY_ROLES, 'record production')
        serializer.save()


class InventoryStockViewSet(SchoolScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    model = InventoryStock
    serializer_class = InventoryStockSerializer
    select_related = ('product', 'school')


class InventoryMovementViewSet(SchoolScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    model = InventoryMovement
    serializer_class = InventoryMovementSerializer
    select_related = ('product', 'activity', 'recorded_by', 'school')


class ProduceSaleViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = ProduceSale
    serializer_class = ProduceSaleSerializer
    select_related = ('activity', 'product', 'recorded_by', 'school')
    http_method_names = ['get', 'post', 'head', 'options']

    def perform_create(self, serializer):
        assert_iga_role(self.request.user, SALES_ENTRY_ROLES, 'record produce sales')
        serializer.save()


class ActivityExpenseViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = ActivityExpense
    serializer_class = ActivityExpenseSerializer
    select_related = ('activity', 'recorded_by', 'approved_by', 'school')
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def perform_create(self, serializer):
        assert_iga_role(self.request.user, EXPENSE_ENTRY_ROLES, 'record activity expenses')
        serializer.save()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        assert_iga_role(request.user, EXPENSE_APPROVAL_ROLES, 'approve activity expenses')
        expense = self.get_object()
        approved_expense = execute_approval(expense=expense, approver=request.user)
        return Response(self.get_serializer(approved_expense).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        assert_iga_role(request.user, EXPENSE_APPROVAL_ROLES, 'reject activity expenses')
        expense = self.get_object()
        serializer = ExpenseDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rejected_expense = execute_rejection(
            expense=expense,
            approver=request.user,
            reason=serializer.validated_data.get('reason', ''),
        )
        return Response(self.get_serializer(rejected_expense).data)


class ActivityBudgetViewSet(SchoolScopedViewMixin, viewsets.ModelViewSet):
    model = ActivityBudget
    serializer_class = ActivityBudgetSerializer
    select_related = ('activity', 'school')


class RecordSpoilageAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def post(self, request):
        assert_iga_role(request.user, INVENTORY_CONTROL_ROLES, 'record inventory spoilage')
        serializer = InventoryActionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = execute_spoilage_action(serializer=serializer)
        return Response(
            {
                'detail': 'Spoilage recorded successfully.',
                'movement_id': result['movement'].id,
                'accounting_entry': result['accounting_entry'],
            },
            status=status.HTTP_201_CREATED,
        )


class RecordInternalConsumptionAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def post(self, request):
        assert_iga_role(request.user, INVENTORY_CONTROL_ROLES, 'record internal produce consumption')
        serializer = InventoryActionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = execute_internal_use_action(serializer=serializer)
        return Response(
            {
                'detail': 'Internal consumption recorded successfully.',
                'movement_id': result['movement'].id,
                'accounting_entry': result['accounting_entry'],
            },
            status=status.HTTP_201_CREATED,
        )


class AdjustInventoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def post(self, request):
        assert_iga_role(request.user, INVENTORY_CONTROL_ROLES, 'adjust inventory')
        serializer = InventoryAdjustmentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = execute_adjustment_action(serializer=serializer)
        return Response(
            {
                'detail': 'Inventory adjusted successfully.',
                'movement_id': result['movement'].id,
                'stock_id': result['stock'].id,
            },
            status=status.HTTP_200_OK,
        )


class ReportBaseAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolUser]

    def get_school(self, request):
        return request.user.school

    def get_date_filters(self, request):
        return parse_date(request.GET.get('start_date', '')) or None, parse_date(request.GET.get('end_date', '')) or None

    def get_int(self, request, key):
        value = request.GET.get(key)
        return int(value) if value else None


class IGAOverviewReportAPIView(ReportBaseAPIView):
    def get(self, request):
        start_date, end_date = self.get_date_filters(request)
        data = get_iga_overview_report(
            school=self.get_school(request),
            start_date=start_date,
            end_date=end_date,
        )
        return Response(data)


class ActivityProfitabilityReportAPIView(ReportBaseAPIView):
    def get(self, request):
        start_date, end_date = self.get_date_filters(request)
        data = get_activity_profitability_report(
            school=self.get_school(request),
            activity_id=self.get_int(request, 'activity_id'),
            start_date=start_date,
            end_date=end_date,
        )
        return Response(data)


class ProductionReportAPIView(ReportBaseAPIView):
    def get(self, request):
        start_date, end_date = self.get_date_filters(request)
        data = get_production_report(
            school=self.get_school(request),
            activity_id=self.get_int(request, 'activity_id'),
            product_id=self.get_int(request, 'product_id'),
            start_date=start_date,
            end_date=end_date,
        )
        return Response(data)


class InventoryReportAPIView(ReportBaseAPIView):
    def get(self, request):
        data = get_inventory_report(
            school=self.get_school(request),
            product_id=self.get_int(request, 'product_id'),
        )
        return Response(data)


class IncomeExpenditureReportAPIView(ReportBaseAPIView):
    def get(self, request):
        start_date, end_date = self.get_date_filters(request)
        data = get_income_vs_expenditure_report(
            school=self.get_school(request),
            activity_id=self.get_int(request, 'activity_id'),
            start_date=start_date,
            end_date=end_date,
        )
        return Response(data)


class BudgetVsActualReportAPIView(ReportBaseAPIView):
    def get(self, request):
        start_date, end_date = self.get_date_filters(request)
        data = get_budget_vs_actual_report(
            school=self.get_school(request),
            activity_id=self.get_int(request, 'activity_id'),
            start_date=start_date,
            end_date=end_date,
        )
        return Response(data)
