from django.db import models
from apps.schools.models import School
from students.models import Student  # Assuming you have this in your students app
from django.db.models import JSONField
from django.utils import timezone


class VoteHead(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vote_heads')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    priority = models.PositiveSmallIntegerField(default=1, help_text="Lower number = higher payment priority")
    fee_applicable = models.BooleanField(default=True, help_text="If ticked, this votehead appears on fees structures and receipts")
    student_group = models.CharField(max_length=100, blank=True, help_text="E.g. Boarding, Day, Playgroup")

    def __str__(self):
        return f"{self.name} ({self.school.name})"

    class Meta:
        app_label = 'fees'
        verbose_name = 'Fee Vote Head'
        ordering = ['priority'] 

class FeeStructure(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_structures')
    year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField()
    vote_head = models.ForeignKey(VoteHead, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        app_label = 'fees'
        unique_together = ('school', 'year', 'term', 'vote_head')

    def __str__(self):
        return f"{self.school.name} | {self.year} Term {self.term} - {self.vote_head.name}: {self.amount}"



PAYMENT_MODES = (
    ('mpesa', 'M-PESA'),
    ('bank', 'Bank'),
    ('cash', 'Cash'),
    ('fees_in_kind', 'Fees In Kind'),
)

class PaymentTransaction(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='transactions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=20, choices=PAYMENT_MODES)
    transaction_code = models.CharField(max_length=100, blank=True)
    date = models.DateTimeField(default=timezone.now)
    remarks = models.TextField(blank=True)
    apportion_log = JSONField(default=dict, help_text="Votehead-wise payment allocations")

    def __str__(self):
        return f"{self.student} | {self.amount} | {self.mode} | {self.transaction_code}"

class FeeBalance(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_balances')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fee_balances')
    vote_head = models.ForeignKey(VoteHead, on_delete=models.CASCADE)
    year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField()
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_invoiced = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    closing_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('school', 'student', 'vote_head', 'year', 'term')

    def __str__(self):
        return f"{self.student} | {self.vote_head.name} | {self.year} T{self.term}"

    def update_balance(self):
        self.closing_balance = self.opening_balance + self.amount_invoiced - self.amount_paid
        self.save()

class DebitTransaction(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    vote_head = models.ForeignKey(VoteHead, on_delete=models.CASCADE)
    year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateTimeField(default=timezone.now)
    remarks = models.TextField(blank=True)
    invoice_number = models.CharField(max_length=50)

    class Meta:
        unique_together = ('school', 'student', 'vote_head', 'year', 'term')

    def __str__(self):
        return f"{self.student} | {self.vote_head.name} | {self.amount} | {self.invoice_number}"
