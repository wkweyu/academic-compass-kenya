from django.db import models
from apps.core.models import SchoolScopedModel
from apps.fees.models import VoteHead


class Supplier(SchoolScopedModel):
    name = models.CharField(max_length=255)
    kra_pin = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    has_student_account = models.BooleanField(default=False)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return self.name
class ItemCategory(SchoolScopedModel):
        name = models.CharField(max_length=255)

        def __str__(self):
            return self.name
        

    
class Item(SchoolScopedModel):
        name = models.CharField(max_length=255)
        category = models.ForeignKey(ItemCategory, on_delete=models.CASCADE)
        preferred_supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
        unit_price = models.DecimalField(max_digits=12, decimal_places=2)
        reorder_level = models.PositiveIntegerField(default=0)
        is_consumable = models.BooleanField(default=False)

        def __str__(self):
            return self.name
    
    

class LPO(SchoolScopedModel):
    lpo_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=[
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Delivered', 'Delivered'),
        ('Paid', 'Paid')
    ], default='Pending')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"LPO {self.lpo_number} - {self.supplier.name}"

class StockTransaction(SchoolScopedModel):
    TRANSACTION_TYPES = (
        ('Purchase', 'Purchase'),
        ('Issue', 'Issue'),
        ('Adjustment', 'Adjustment'),
    )

    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    quantity = models.PositiveIntegerField()
    transaction_date = models.DateTimeField(auto_now_add=True)
    related_lpo = models.ForeignKey(LPO, on_delete=models.SET_NULL, null=True, blank=True)
    issued_to = models.CharField(max_length=255, null=True, blank=True)  # e.g Kitchen, Class 4 East, Student Name
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.transaction_type} - {self.item.name}"


class PaymentVoucher(SchoolScopedModel):
    voucher_number = models.CharField(max_length=50, unique=True)
    date = models.DateField(auto_now_add=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=[
        ('Cash', 'Cash'),
        ('Cheque', 'Cheque'),
        ('MPESA', 'MPESA'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Fees In-Kind', 'Fees In-Kind')
    ])
    vote_head = models.ForeignKey(VoteHead, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('Draft', 'Draft'),
        ('Approved', 'Approved'),
        ('Paid', 'Paid')
    ], default='Draft')
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Voucher {self.voucher_number}"

class PettyCashTransaction(SchoolScopedModel):
    date = models.DateTimeField(auto_now_add=True)
    transaction_type = models.CharField(max_length=20, choices=[
        ('Top-up', 'Top-up'),
        ('Expense', 'Expense')
    ])
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField()
    vote_head = models.ForeignKey(VoteHead, on_delete=models.SET_NULL, null=True, blank=True)
    related_voucher = models.ForeignKey(PaymentVoucher, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.transaction_type} KES {self.amount}"

class FeesInKindTransaction(SchoolScopedModel):
    date = models.DateTimeField(auto_now_add=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    vote_head = models.ForeignKey(VoteHead, on_delete=models.SET_NULL, null=True)
    term = models.PositiveIntegerField()
    year = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.supplier.name} to {self.student.full_name} KES {self.amount}"
