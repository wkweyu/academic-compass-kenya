from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    ActivityExpense,
    ExpenseStatus,
    InventoryMovement,
    InventoryMovementType,
    InventoryStock,
    PaymentMethod,
    ProduceSale,
    ProductionRecord,
)


TWOPLACES = Decimal('0.01')


class InventoryError(Exception):
    pass


def quantize_amount(value):
    return Decimal(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _build_reference(prefix, instance_id):
    return f"IGA-{prefix}-{instance_id}"


def _validate_school_scope(*, school, **instances):
    for field_name, instance in instances.items():
        if instance is None:
            continue
        if getattr(instance, 'school_id', None) != school.id:
            raise ValidationError({field_name: 'Selected record must belong to the same school.'})


def _save_with_validation(instance, *, update_fields=None):
    instance.full_clean()
    if update_fields:
        instance.save(update_fields=update_fields)
    else:
        instance.save()
    return instance


def _resolve_inventory_account_id(activity, product):
    return getattr(activity, 'inventory_account_id', None) or product.inventory_account_id


@transaction.atomic
def get_or_create_stock(*, school, product, unit=None):
    _validate_school_scope(school=school, product=product)
    stock = InventoryStock.objects.select_for_update().filter(school=school, product=product).first()
    if not stock:
        stock = InventoryStock(
            school=school,
            product=product,
            unit=unit or product.unit_of_measure,
        )
        _save_with_validation(stock)
    if not stock.unit:
        stock.unit = unit or product.unit_of_measure
        _save_with_validation(stock, update_fields=['unit', 'last_updated'])
    return stock


@transaction.atomic
def update_stock(*, school, product, quantity_delta, unit=None):
    _validate_school_scope(school=school, product=product)
    quantity_delta = quantize_amount(quantity_delta)
    stock = get_or_create_stock(school=school, product=product, unit=unit)
    new_quantity = quantize_amount(stock.quantity_available + quantity_delta)
    if new_quantity < 0:
        raise InventoryError(f"Insufficient stock for {product.name}.")
    stock.quantity_available = new_quantity
    stock.unit = unit or stock.unit or product.unit_of_measure
    _save_with_validation(stock, update_fields=['quantity_available', 'unit', 'last_updated'])
    return stock


def create_inventory_movement(*, school, product, activity=None, movement_type, quantity, unit=None, reference='', recorded_by=None, notes='', accounting_entry=None, accounting_posted_at=None):
    _validate_school_scope(school=school, product=product, activity=activity)
    movement = InventoryMovement(
        school=school,
        product=product,
        activity=activity,
        movement_type=movement_type,
        quantity=quantize_amount(quantity),
        unit=unit or product.unit_of_measure,
        reference=reference,
        recorded_by=recorded_by,
        notes=notes,
        accounting_entry=accounting_entry or {},
        accounting_posted_at=accounting_posted_at,
    )
    return _save_with_validation(movement)


def post_activity_expense(expense):
    return {
        'entry_type': 'iga_expense',
        'posted_at': timezone.now().isoformat(),
        'debit_account_id': expense.activity.expense_account_id,
        'credit_account': 'cash_or_payables',
        'amount': str(expense.amount),
        'activity_id': expense.activity_id,
        'expense_id': expense.id,
        'description': expense.description,
    }


def post_produce_sale(sale):
    return {
        'entry_type': 'iga_sale',
        'posted_at': timezone.now().isoformat(),
        'debit_account': sale.payment_method,
        'credit_account_id': sale.activity.income_account_id or sale.product.income_account_id,
        'amount': str(sale.total_amount),
        'activity_id': sale.activity_id,
        'sale_id': sale.id,
        'description': sale.reference or f"Sale of {sale.product.name}",
    }


def post_inventory_loss(*, activity, product, quantity, reference):
    return {
        'entry_type': 'iga_inventory_loss',
        'posted_at': timezone.now().isoformat(),
        'debit_account': 'inventory_loss',
        'credit_account_id': _resolve_inventory_account_id(activity, product),
        'quantity': str(quantize_amount(quantity)),
        'reference': reference,
        'activity_id': getattr(activity, 'id', None),
        'product_id': product.id,
    }


def post_internal_consumption(*, activity, product, quantity, reference):
    return {
        'entry_type': 'iga_internal_consumption',
        'posted_at': timezone.now().isoformat(),
        'debit_account': 'kitchen_supplies',
        'credit_account_id': _resolve_inventory_account_id(activity, product),
        'quantity': str(quantize_amount(quantity)),
        'reference': reference,
        'activity_id': getattr(activity, 'id', None),
        'product_id': product.id,
    }


@transaction.atomic
def record_production(*, school, activity, product, quantity, unit=None, production_date=None, recorded_by=None, notes=''):
    _validate_school_scope(school=school, activity=activity, product=product)
    quantity = quantize_amount(quantity)
    unit = unit or product.unit_of_measure
    production_record = ProductionRecord(
        school=school,
        activity=activity,
        product=product,
        quantity=quantity,
        unit=unit,
        production_date=production_date or timezone.localdate(),
        recorded_by=recorded_by,
        notes=notes,
    )
    _save_with_validation(production_record)
    reference = _build_reference('PROD', production_record.id)
    update_stock(school=school, product=product, quantity_delta=quantity, unit=unit)
    create_inventory_movement(
        school=school,
        product=product,
        activity=activity,
        movement_type=InventoryMovementType.PRODUCTION,
        quantity=quantity,
        unit=unit,
        reference=reference,
        recorded_by=recorded_by,
        notes=notes,
    )
    return production_record


@transaction.atomic
def record_sale(*, school, activity, product, quantity, unit_price=None, customer_name='', sale_date=None, payment_method=PaymentMethod.CASH, recorded_by=None, reference='', notes=''):
    _validate_school_scope(school=school, activity=activity, product=product)
    quantity = quantize_amount(quantity)
    unit_price = quantize_amount(unit_price or product.sale_price)
    total_amount = quantize_amount(quantity * unit_price)
    update_stock(school=school, product=product, quantity_delta=-quantity, unit=product.unit_of_measure)
    sale = ProduceSale(
        school=school,
        activity=activity,
        product=product,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        customer_name=customer_name,
        sale_date=sale_date or timezone.localdate(),
        payment_method=payment_method,
        recorded_by=recorded_by,
        reference=reference,
    )
    _save_with_validation(sale)
    movement_reference = reference or _build_reference('SALE', sale.id)
    create_inventory_movement(
        school=school,
        product=product,
        activity=activity,
        movement_type=InventoryMovementType.SALE,
        quantity=quantity,
        unit=product.unit_of_measure,
        reference=movement_reference,
        recorded_by=recorded_by,
        notes=notes,
    )
    sale.accounting_entry = post_produce_sale(sale)
    sale.accounting_posted_at = timezone.now()
    _save_with_validation(sale, update_fields=['accounting_entry', 'accounting_posted_at'])
    return sale


def create_expense(*, school, activity, expense_category, description, amount, expense_date=None, recorded_by=None, procurement_reference=''):
    _validate_school_scope(school=school, activity=activity)
    expense = ActivityExpense(
        school=school,
        activity=activity,
        expense_category=expense_category,
        description=description,
        amount=quantize_amount(amount),
        expense_date=expense_date or timezone.localdate(),
        recorded_by=recorded_by,
        procurement_reference=procurement_reference,
    )
    return _save_with_validation(expense)


@transaction.atomic
def approve_expense(*, expense, approver):
    if expense.status != ExpenseStatus.PENDING:
        raise ValueError('Only pending expenses can be approved.')
    expense.status = ExpenseStatus.APPROVED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = ''
    expense.accounting_entry = post_activity_expense(expense)
    expense.accounting_posted_at = timezone.now()
    _save_with_validation(
        expense,
        update_fields=[
            'status',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'accounting_entry',
            'accounting_posted_at',
            'updated_at',
        ],
    )
    return expense


@transaction.atomic
def reject_expense(*, expense, approver=None, reason=''):
    if expense.status != ExpenseStatus.PENDING:
        raise ValueError('Only pending expenses can be rejected.')
    expense.status = ExpenseStatus.REJECTED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = reason
    expense.accounting_entry = {}
    expense.accounting_posted_at = None
    _save_with_validation(
        expense,
        update_fields=[
            'status',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'accounting_entry',
            'accounting_posted_at',
            'updated_at',
        ],
    )
    return expense


@transaction.atomic
def record_spoilage(*, school, product, quantity, activity=None, reference='', recorded_by=None, notes=''):
    _validate_school_scope(school=school, product=product, activity=activity)
    quantity = quantize_amount(quantity)
    update_stock(school=school, product=product, quantity_delta=-quantity, unit=product.unit_of_measure)
    reference = reference or _build_reference('SPOIL', timezone.now().strftime('%Y%m%d%H%M%S'))
    accounting_entry = post_inventory_loss(activity=activity, product=product, quantity=quantity, reference=reference)
    movement = create_inventory_movement(
        school=school,
        product=product,
        activity=activity,
        movement_type=InventoryMovementType.SPOILAGE,
        quantity=quantity,
        unit=product.unit_of_measure,
        reference=reference,
        recorded_by=recorded_by,
        notes=notes,
        accounting_entry=accounting_entry,
        accounting_posted_at=timezone.now(),
    )
    return {
        'movement': movement,
        'accounting_entry': accounting_entry,
    }


@transaction.atomic
def record_internal_consumption(*, school, product, quantity, activity=None, reference='', recorded_by=None, notes=''):
    _validate_school_scope(school=school, product=product, activity=activity)
    quantity = quantize_amount(quantity)
    update_stock(school=school, product=product, quantity_delta=-quantity, unit=product.unit_of_measure)
    reference = reference or _build_reference('USE', timezone.now().strftime('%Y%m%d%H%M%S'))
    accounting_entry = post_internal_consumption(activity=activity, product=product, quantity=quantity, reference=reference)
    movement = create_inventory_movement(
        school=school,
        product=product,
        activity=activity,
        movement_type=InventoryMovementType.INTERNAL_USE,
        quantity=quantity,
        unit=product.unit_of_measure,
        reference=reference,
        recorded_by=recorded_by,
        notes=notes,
        accounting_entry=accounting_entry,
        accounting_posted_at=timezone.now(),
    )
    return {
        'movement': movement,
        'accounting_entry': accounting_entry,
    }


@transaction.atomic
def adjust_inventory(*, school, product, quantity_delta, activity=None, reference='', recorded_by=None, notes=''):
    _validate_school_scope(school=school, product=product, activity=activity)
    quantity_delta = quantize_amount(quantity_delta)
    if quantity_delta == 0:
        raise ValueError('Quantity delta cannot be zero.')
    stock = update_stock(school=school, product=product, quantity_delta=quantity_delta, unit=product.unit_of_measure)
    movement = create_inventory_movement(
        school=school,
        product=product,
        activity=activity,
        movement_type=InventoryMovementType.ADJUSTMENT,
        quantity=abs(quantity_delta),
        unit=product.unit_of_measure,
        reference=reference or _build_reference('ADJ', timezone.now().strftime('%Y%m%d%H%M%S')),
        recorded_by=recorded_by,
        notes=notes,
    )
    return {'stock': stock, 'movement': movement}
