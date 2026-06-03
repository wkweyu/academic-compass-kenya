from apps.fees.models import FinanceActivityLog
from django.utils import timezone

def log_finance_activity(school, user, action, object_id=None, details=None, result=None, message=None):
    """
    Utility to log finance-related actions for auditability.
    Args:
        school (School): School instance
        user (User): User instance (can be None)
        action (str): Action type (must match FinanceActivityLog.ACTION_CHOICES)
        object_id (str, optional): ID of the affected object
        details (dict, optional): Additional context or parameters
        result (str, optional): Result status (e.g., SUCCESS, FAILURE)
        message (str, optional): Optional message or error details
    Returns:
        FinanceActivityLog: The created log entry
    """
    log = FinanceActivityLog.objects.create(
        school=school,
        user=user,
        action=action,
        timestamp=timezone.now(),
        object_id=object_id or '',
        details=details or {},
        result=result or '',
        message=message or ''
    )
    return log
