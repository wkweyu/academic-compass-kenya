from decimal import Decimal

from django.db.models import Sum

from .models import Activity, ActivityBudget, ActivityExpense, ExpenseStatus, InventoryMovement, InventoryMovementType, InventoryStock, ProduceSale, ProductionRecord


ZERO = Decimal('0.00')


def _date_filter(queryset, field_name, start_date=None, end_date=None):
    if start_date:
        queryset = queryset.filter(**{f'{field_name}__gte': start_date})
    if end_date:
        queryset = queryset.filter(**{f'{field_name}__lte': end_date})
    return queryset


def get_activity_profitability_report(*, school, activity_id=None, start_date=None, end_date=None):
    activities = Activity.objects.filter(school=school)
    if activity_id:
        activities = activities.filter(id=activity_id)

    sales = _date_filter(ProduceSale.objects.filter(school=school), 'sale_date', start_date, end_date)
    expenses = _date_filter(
        ActivityExpense.objects.filter(school=school, status=ExpenseStatus.APPROVED),
        'expense_date',
        start_date,
        end_date,
    )

    sales_by_activity = {
        row['activity_id']: row['total_sales'] or ZERO
        for row in sales.values('activity_id').annotate(total_sales=Sum('total_amount'))
    }
    expenses_by_activity = {
        row['activity_id']: row['total_expenses'] or ZERO
        for row in expenses.values('activity_id').annotate(total_expenses=Sum('amount'))
    }

    data = []
    for activity in activities:
        total_sales = sales_by_activity.get(activity.id, ZERO)
        total_expenses = expenses_by_activity.get(activity.id, ZERO)
        data.append(
            {
                'activity_id': activity.id,
                'activity_name': activity.name,
                'total_sales': total_sales,
                'total_expenses': total_expenses,
                'net_profit_loss': total_sales - total_expenses,
            }
        )
    return data


def get_production_report(*, school, activity_id=None, product_id=None, start_date=None, end_date=None):
    records = ProductionRecord.objects.filter(school=school).select_related('activity', 'product')
    if activity_id:
        records = records.filter(activity_id=activity_id)
    if product_id:
        records = records.filter(product_id=product_id)
    records = _date_filter(records, 'production_date', start_date, end_date)

    grouped = (
        records.values('production_date', 'activity__name', 'product__name', 'unit')
        .annotate(total_quantity=Sum('quantity'))
        .order_by('-production_date', 'activity__name', 'product__name')
    )
    return list(grouped)


def get_inventory_report(*, school, product_id=None):
    stock_queryset = InventoryStock.objects.filter(school=school).select_related('product')
    if product_id:
        stock_queryset = stock_queryset.filter(product_id=product_id)

    movement_queryset = InventoryMovement.objects.filter(school=school)
    if product_id:
        movement_queryset = movement_queryset.filter(product_id=product_id)

    sold_quantities = {
        row['product_id']: row['total'] or ZERO
        for row in movement_queryset.filter(movement_type=InventoryMovementType.SALE)
        .values('product_id')
        .annotate(total=Sum('quantity'))
    }
    spoiled_quantities = {
        row['product_id']: row['total'] or ZERO
        for row in movement_queryset.filter(movement_type=InventoryMovementType.SPOILAGE)
        .values('product_id')
        .annotate(total=Sum('quantity'))
    }
    internal_use_quantities = {
        row['product_id']: row['total'] or ZERO
        for row in movement_queryset.filter(movement_type=InventoryMovementType.INTERNAL_USE)
        .values('product_id')
        .annotate(total=Sum('quantity'))
    }

    data = []
    for stock in stock_queryset:
        data.append(
            {
                'product_id': stock.product_id,
                'product_name': stock.product.name,
                'unit': stock.unit,
                'quantity_available': stock.quantity_available,
                'stock_value': stock.quantity_available * stock.product.sale_price,
                'sold_quantity': sold_quantities.get(stock.product_id, ZERO),
                'spoiled_quantity': spoiled_quantities.get(stock.product_id, ZERO),
                'internal_use_quantity': internal_use_quantities.get(stock.product_id, ZERO),
                'last_updated': stock.last_updated,
            }
        )
    return data


def get_income_vs_expenditure_report(*, school, activity_id=None, start_date=None, end_date=None):
    sales = ProduceSale.objects.filter(school=school)
    expenses = ActivityExpense.objects.filter(school=school, status=ExpenseStatus.APPROVED)
    if activity_id:
        sales = sales.filter(activity_id=activity_id)
        expenses = expenses.filter(activity_id=activity_id)

    sales = _date_filter(sales, 'sale_date', start_date, end_date)
    expenses = _date_filter(expenses, 'expense_date', start_date, end_date)

    total_income = sales.aggregate(total=Sum('total_amount'))['total'] or ZERO
    total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or ZERO
    return {
        'total_income': total_income,
        'total_expenses': total_expenses,
        'net_income': total_income - total_expenses,
    }


def get_budget_vs_actual_report(*, school, activity_id=None, start_date=None, end_date=None):
    budgets = ActivityBudget.objects.filter(school=school).select_related('activity')
    if activity_id:
        budgets = budgets.filter(activity_id=activity_id)
    if start_date:
        budgets = budgets.filter(period_end__gte=start_date)
    if end_date:
        budgets = budgets.filter(period_start__lte=end_date)

    expense_queryset = ActivityExpense.objects.filter(school=school, status=ExpenseStatus.APPROVED)
    if activity_id:
        expense_queryset = expense_queryset.filter(activity_id=activity_id)
    expense_queryset = _date_filter(expense_queryset, 'expense_date', start_date, end_date)

    data = []
    for budget in budgets:
        actual_amount = (
            expense_queryset.filter(
                activity=budget.activity,
                expense_category__iexact=budget.category,
                expense_date__gte=budget.period_start,
                expense_date__lte=budget.period_end,
            ).aggregate(total=Sum('amount'))['total']
            or ZERO
        )
        data.append(
            {
                'budget_id': budget.id,
                'activity_id': budget.activity_id,
                'activity_name': budget.activity.name,
                'category': budget.category,
                'period_start': budget.period_start,
                'period_end': budget.period_end,
                'budget_amount': budget.budget_amount,
                'actual_amount': actual_amount,
                'variance': budget.budget_amount - actual_amount,
            }
        )
    return data


def get_iga_overview_report(*, school, start_date=None, end_date=None):
    profitability = get_activity_profitability_report(
        school=school,
        start_date=start_date,
        end_date=end_date,
    )
    production = get_production_report(
        school=school,
        start_date=start_date,
        end_date=end_date,
    )
    inventory = get_inventory_report(school=school)
    income_vs_expenditure = get_income_vs_expenditure_report(
        school=school,
        start_date=start_date,
        end_date=end_date,
    )
    budget_vs_actual = get_budget_vs_actual_report(
        school=school,
        start_date=start_date,
        end_date=end_date,
    )
    recent_movements = list(
        InventoryMovement.objects.filter(school=school)
        .select_related('product', 'activity', 'recorded_by')
        .order_by('-date', '-id')[:10]
        .values(
            'id',
            'movement_type',
            'quantity',
            'unit',
            'reference',
            'date',
            'product__name',
            'activity__name',
            'recorded_by__first_name',
            'recorded_by__last_name',
        )
    )

    return {
        'summary': {
            'activity_count': Activity.objects.filter(school=school).count(),
            'active_activity_count': Activity.objects.filter(school=school, status='active').count(),
            'product_count': InventoryStock.objects.filter(school=school).values('product_id').distinct().count(),
            'pending_expense_count': ActivityExpense.objects.filter(school=school, status=ExpenseStatus.PENDING).count(),
            'stock_value': sum((item['stock_value'] for item in inventory), ZERO),
            **income_vs_expenditure,
        },
        'profitability': profitability,
        'production': production,
        'inventory': inventory,
        'income_vs_expenditure': income_vs_expenditure,
        'budget_vs_actual': budget_vs_actual,
        'recent_movements': recent_movements,
    }
