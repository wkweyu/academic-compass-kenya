
from django.db import models
from django.db.models import Q
from apps.schools.models import School
from apps.students.models import Student
from django.db.models import JSONField
from django.utils import timezone
from apps.core.managers import SchoolManager

# FinanceActivityLog model (for audit logging)
from django.utils import timezone
from apps.users.models import User

class FinanceActivityLog(models.Model):
    ACTION_CHOICES = [
        ('REPROCESS', 'Reprocess'),
        ('TERM_CLOSE', 'Term Close'),
        ('PAYMENT', 'Payment'),
        ('REFUND', 'Refund'),
        ('ADJUSTMENT', 'Adjustment'),
        ('EXPORT', 'Export'),
        # Add more as needed
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='finance_activity_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='finance_activity_logs')
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(default=timezone.now)
    object_id = models.CharField(max_length=64, blank=True, help_text='ID of the object affected (e.g. payment, term close, etc)')
    details = models.JSONField(default=dict, blank=True, help_text='Additional context or parameters for the action')
    result = models.CharField(max_length=32, blank=True, help_text='Result status, e.g. SUCCESS, FAILURE')
    message = models.TextField(blank=True, help_text='Optional message or error details')

    class Meta:
        db_table = 'fees_finance_activity_log'
        ordering = ['-timestamp', '-id']

    def __str__(self):
        return f'{self.school.name} | {self.action} | {self.timestamp} | {self.result}'


class VoteHead(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vote_heads')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    priority = models.PositiveSmallIntegerField(default=1, help_text="Lower number = higher payment priority")
    fee_applicable = models.BooleanField(default=True, help_text="If ticked, this votehead appears on fees structures and receipts")
    student_group = models.CharField(max_length=100, blank=True, help_text="E.g. Boarding, Day, Playgroup")
    objects = models.Manager()  # Default manager
    
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
    objects = SchoolManager()

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
    objects = SchoolManager()
    
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
    objects = SchoolManager()

    class Meta:
        unique_together = ('school', 'student', 'vote_head', 'year', 'term')

    def __str__(self):
        return f"{self.student} | {self.vote_head.name} | {self.amount} | {self.invoice_number}"


TERM_CLOSE_STATUS = (
    ('CLOSING', 'Closing'),
    ('CLOSED', 'Closed'),
    ('FAILED', 'Failed'),
)


TARGET_BALANCE_TYPE = (
    ('ARREARS', 'Arrears'),
    ('PREPAYMENT', 'Prepayment'),
)


SCHEDULED_EXPORT_REPORT = (
    ('outstanding', 'Outstanding Balances'),
    ('student_aging', 'Student Aging'),
    ('collection_effectiveness', 'Collection Effectiveness'),
    ('activity_log', 'Finance Activity Log'),
)


SCHEDULED_EXPORT_STATUS = (
    ('SCHEDULED', 'Scheduled'),
    ('READY', 'Ready'),
    ('COMPLETED', 'Completed'),
    ('CANCELLED', 'Cancelled'),
)


class TermClosePeriod(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='term_close_periods')
    year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField()
    target_year = models.PositiveIntegerField()
    target_term = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=TERM_CLOSE_STATUS, default='CLOSING')
    started_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='term_closes_started')
    closed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='term_closes_closed')
    started_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    rows_processed = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'fees_term_close_period'
        unique_together = ('school', 'year', 'term')
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'year', 'term'],
                condition=Q(status='CLOSED'),
                name='fees_single_closed_period_lock',
            )
        ]

    def __str__(self):
        return f'{self.school.name} | {self.year} T{self.term} -> {self.target_year} T{self.target_term}'


class TermCloseConversionDetail(models.Model):
    period = models.ForeignKey(TermClosePeriod, on_delete=models.CASCADE, related_name='conversion_details')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='term_close_conversion_details')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='term_close_conversion_details')
    source_year = models.PositiveIntegerField()
    source_term = models.PositiveSmallIntegerField()
    target_year = models.PositiveIntegerField()
    target_term = models.PositiveSmallIntegerField()
    source_vote_head = models.ForeignKey(VoteHead, on_delete=models.PROTECT, related_name='source_term_close_details')
    source_closing_balance = models.DecimalField(max_digits=12, decimal_places=2)
    target_type = models.CharField(max_length=12, choices=TARGET_BALANCE_TYPE)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fees_term_close_conversion_detail'
        ordering = ['student_id', 'target_type', 'source_vote_head__priority', 'source_vote_head__name']

    def __str__(self):
        return (
            f'{self.student} | {self.source_year}T{self.source_term} | '
            f'{self.source_vote_head.name} -> {self.target_type}'
        )


class ScheduledExportJob(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='scheduled_export_jobs')
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='scheduled_exports_created')
    report = models.CharField(max_length=40, choices=SCHEDULED_EXPORT_REPORT)
    filters = JSONField(default=dict, blank=True)
    run_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=SCHEDULED_EXPORT_STATUS, default='SCHEDULED')
    executed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fees_scheduled_export_job'
        ordering = ['-run_at', '-id']

    def __str__(self):
        return f'{self.school.name} | {self.report} @ {self.run_at.isoformat()} ({self.status})'
