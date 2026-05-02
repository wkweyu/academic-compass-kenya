from django.contrib import admin

from .models import (
    Activity,
    ActivityBudget,
    ActivityExpense,
    InventoryMovement,
    InventoryStock,
    Product,
    ProduceSale,
    ProductionRecord,
)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'status', 'manager', 'start_date')
    list_filter = ('status', 'school')
    search_fields = ('name', 'description')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'unit_of_measure', 'sale_price', 'is_active')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'description')


@admin.register(InventoryStock)
class InventoryStockAdmin(admin.ModelAdmin):
    list_display = ('product', 'school', 'quantity_available', 'unit', 'last_updated')
    list_filter = ('school',)
    search_fields = ('product__name',)


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'activity', 'school', 'movement_type', 'quantity', 'unit', 'date')
    list_filter = ('school', 'movement_type', 'date')
    search_fields = ('product__name', 'activity__name', 'reference')


@admin.register(ProductionRecord)
class ProductionRecordAdmin(admin.ModelAdmin):
    list_display = ('activity', 'product', 'school', 'quantity', 'unit', 'production_date', 'recorded_by')
    list_filter = ('school', 'production_date')
    search_fields = ('activity__name', 'product__name')


@admin.register(ProduceSale)
class ProduceSaleAdmin(admin.ModelAdmin):
    list_display = ('activity', 'product', 'school', 'quantity', 'total_amount', 'payment_method', 'sale_date')
    list_filter = ('school', 'payment_method', 'sale_date')
    search_fields = ('activity__name', 'product__name', 'customer_name', 'reference')


@admin.register(ActivityExpense)
class ActivityExpenseAdmin(admin.ModelAdmin):
    list_display = ('activity', 'school', 'expense_category', 'amount', 'status', 'expense_date', 'approved_by')
    list_filter = ('school', 'status', 'expense_category', 'expense_date')
    search_fields = ('activity__name', 'description', 'procurement_reference')


@admin.register(ActivityBudget)
class ActivityBudgetAdmin(admin.ModelAdmin):
    list_display = ('activity', 'school', 'category', 'budget_amount', 'period_start', 'period_end')
    list_filter = ('school', 'category')
    search_fields = ('activity__name', 'category', 'notes')
