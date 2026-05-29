from django.db import models
from django.utils import timezone
from apps.schools.models import School
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
