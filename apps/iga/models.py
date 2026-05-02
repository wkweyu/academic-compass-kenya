from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.schools.models import School


class IGABaseModel(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='%(class)ss')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ActivityStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    PLANNED = 'planned', 'Planned'
    ON_HOLD = 'on_hold', 'On Hold'
    CLOSED = 'closed', 'Closed'


class InventoryMovementType(models.TextChoices):
    PRODUCTION = 'production', 'Production'
    SALE = 'sale', 'Sale'
    INTERNAL_USE = 'internal_use', 'Internal Use'
    SPOILAGE = 'spoilage', 'Spoilage'
    ADJUSTMENT = 'adjustment', 'Adjustment'


class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Cash'
    MPESA = 'mpesa', 'M-PESA'
    BANK = 'bank', 'Bank'
    CREDIT = 'credit', 'Credit'
    OTHER = 'other', 'Other'


class ExpenseStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class ExpenseCategory(models.TextChoices):
    FEED = 'feed', 'Feed'
    FERTILIZER = 'fertilizer', 'Fertilizer'
    SEEDS = 'seeds', 'Seeds'
    MEDICINE = 'medicine', 'Medicine'
    FUEL = 'fuel', 'Fuel'
    LABOUR = 'labour', 'Labour'
    MAINTENANCE = 'maintenance', 'Maintenance'
    OTHER = 'other', 'Other'


class Activity(IGABaseModel):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_iga_activities',
    )
    start_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=20, choices=ActivityStatus.choices, default=ActivityStatus.ACTIVE)
    income_account_id = models.PositiveIntegerField(null=True, blank=True)
    expense_account_id = models.PositiveIntegerField(null=True, blank=True)
    inventory_account_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['name']
        unique_together = ('school', 'name')

    def __str__(self):
        return self.name


class Product(IGABaseModel):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=30)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    inventory_account_id = models.PositiveIntegerField(null=True, blank=True)
    income_account_id = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = ('school', 'name')

    def __str__(self):
        return self.name


class InventoryStock(IGABaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory_stocks')
    quantity_available = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    unit = models.CharField(max_length=30)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product__name']
        unique_together = ('school', 'product')

    def clean(self):
        if self.product.school_id != self.school_id:
            raise ValidationError({'product': 'Product must belong to the same school.'})
        if self.quantity_available < 0:
            raise ValidationError({'quantity_available': 'Quantity available cannot be negative.'})

    def __str__(self):
        return f"{self.product.name}: {self.quantity_available} {self.unit}"


class ProductionRecord(IGABaseModel):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='production_records')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='production_records')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=30)
    production_date = models.DateField(default=timezone.localdate)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='iga_production_records',
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-production_date', '-id']

    def clean(self):
        if self.activity.school_id != self.school_id:
            raise ValidationError({'activity': 'Activity must belong to the same school.'})
        if self.product.school_id != self.school_id:
            raise ValidationError({'product': 'Product must belong to the same school.'})
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})

    def __str__(self):
        return f"{self.activity.name} - {self.product.name} ({self.quantity} {self.unit})"


class InventoryMovement(IGABaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory_movements')
    activity = models.ForeignKey(
        Activity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_movements',
    )
    movement_type = models.CharField(max_length=20, choices=InventoryMovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=30)
    reference = models.CharField(max_length=100, blank=True)
    date = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='iga_inventory_movements',
    )
    notes = models.TextField(blank=True)
    accounting_entry = models.JSONField(default=dict, blank=True)
    accounting_posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date', '-id']

    def clean(self):
        if self.product.school_id != self.school_id:
            raise ValidationError({'product': 'Product must belong to the same school.'})
        if self.activity_id and self.activity.school_id != self.school_id:
            raise ValidationError({'activity': 'Activity must belong to the same school.'})
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.product.name} ({self.quantity} {self.unit})"


class ProduceSale(IGABaseModel):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='produce_sales')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='produce_sales')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    customer_name = models.CharField(max_length=255, blank=True)
    sale_date = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='iga_produce_sales',
    )
    reference = models.CharField(max_length=100, blank=True)
    accounting_entry = models.JSONField(default=dict, blank=True)
    accounting_posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-sale_date', '-id']

    def clean(self):
        if self.activity.school_id != self.school_id:
            raise ValidationError({'activity': 'Activity must belong to the same school.'})
        if self.product.school_id != self.school_id:
            raise ValidationError({'product': 'Product must belong to the same school.'})
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if self.unit_price <= 0:
            raise ValidationError({'unit_price': 'Unit price must be greater than zero.'})

    def __str__(self):
        return f"{self.product.name} sale - {self.total_amount}"


class ActivityExpense(IGABaseModel):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='expenses')
    expense_category = models.CharField(max_length=30, choices=ExpenseCategory.choices, default=ExpenseCategory.OTHER)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=20, choices=ExpenseStatus.choices, default=ExpenseStatus.PENDING)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='iga_recorded_expenses',
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='iga_approved_expenses',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    procurement_reference = models.CharField(max_length=100, blank=True)
    rejection_reason = models.TextField(blank=True)
    accounting_entry = models.JSONField(default=dict, blank=True)
    accounting_posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-expense_date', '-id']

    def clean(self):
        if self.activity.school_id != self.school_id:
            raise ValidationError({'activity': 'Activity must belong to the same school.'})
        if self.amount <= 0:
            raise ValidationError({'amount': 'Amount must be greater than zero.'})

    def __str__(self):
        return f"{self.activity.name} - {self.expense_category} ({self.amount})"


class ActivityBudget(IGABaseModel):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='budgets')
    category = models.CharField(max_length=50)
    budget_amount = models.DecimalField(max_digits=12, decimal_places=2)
    period_start = models.DateField()
    period_end = models.DateField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-period_start', 'activity__name', 'category']
        unique_together = ('school', 'activity', 'category', 'period_start', 'period_end')

    def clean(self):
        if self.activity.school_id != self.school_id:
            raise ValidationError({'activity': 'Activity must belong to the same school.'})
        if self.budget_amount < 0:
            raise ValidationError({'budget_amount': 'Budget amount cannot be negative.'})
        if self.period_end < self.period_start:
            raise ValidationError({'period_end': 'Period end cannot be earlier than period start.'})

    def __str__(self):
        return f"{self.activity.name} - {self.category}"
