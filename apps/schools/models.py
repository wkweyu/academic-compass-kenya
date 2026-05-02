from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class SchoolStatus(models.TextChoices):
    LEAD = 'LEAD', 'Lead'
    ONBOARDING = 'ONBOARDING', 'Onboarding'
    ACTIVE = 'ACTIVE', 'Active'
    CHURNED = 'CHURNED', 'Churned'


class LeadStage(models.TextChoices):
    NEW = 'NEW', 'New'
    CONTACTED = 'CONTACTED', 'Contacted'
    DEMO_SCHEDULED = 'DEMO_SCHEDULED', 'Demo Scheduled'
    DEMO_COMPLETED = 'DEMO_COMPLETED', 'Demo Completed'
    NEGOTIATION = 'NEGOTIATION', 'Negotiation'
    CONTRACT_SENT = 'CONTRACT_SENT', 'Contract Sent'
    WON = 'WON', 'Won'
    LOST = 'LOST', 'Lost'


class LeadPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'


class OnboardingStep(models.TextChoices):
    BASIC_INFO = 'BASIC_INFO', 'Basic Info'
    PLAN_SELECTION = 'PLAN_SELECTION', 'Plan Selection'
    ADMIN_SETUP = 'ADMIN_SETUP', 'Admin Setup'
    DATA_IMPORT = 'DATA_IMPORT', 'Data Import'
    CONFIGURATION = 'CONFIGURATION', 'Configuration'
    TRAINING = 'TRAINING', 'Training'
    HANDBOOK = 'HANDBOOK', 'Handbook'


class TaskStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETE = 'COMPLETE', 'Complete'
    BLOCKED = 'BLOCKED', 'Blocked'


class HealthTrend(models.TextChoices):
    IMPROVING = 'IMPROVING', 'Improving'
    DECLINING = 'DECLINING', 'Declining'
    STABLE = 'STABLE', 'Stable'


class OpportunityStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    CONTACT_MADE = 'CONTACT_MADE', 'Contact Made'
    PROPOSAL_SENT = 'PROPOSAL_SENT', 'Proposal Sent'
    NEGOTIATION = 'NEGOTIATION', 'Negotiation'
    WON = 'WON', 'Won'
    LOST = 'LOST', 'Lost'


class CommunicationType(models.TextChoices):
    EMAIL = 'EMAIL', 'Email'
    CALL = 'CALL', 'Call'
    MEETING = 'MEETING', 'Meeting'
    NOTE = 'NOTE', 'Note'
    TASK = 'TASK', 'Task'


class CommunicationDirection(models.TextChoices):
    OUTBOUND = 'OUTBOUND', 'Outbound'
    INBOUND = 'INBOUND', 'Inbound'
    INTERNAL = 'INTERNAL', 'Internal'


class NotificationChannel(models.TextChoices):
    IN_APP = 'IN_APP', 'In App'
    EMAIL = 'EMAIL', 'Email'
    SMS = 'SMS', 'SMS'


class NotificationScheduleType(models.TextChoices):
    IMMEDIATE = 'IMMEDIATE', 'Immediate'
    DIGEST = 'DIGEST', 'Digest'
    SPECIFIC_TIME = 'SPECIFIC_TIME', 'Specific Time'


class NotificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    SENT = 'SENT', 'Sent'
    FAILED = 'FAILED', 'Failed'
    READ = 'READ', 'Read'


class FollowUpType(models.TextChoices):
    QUICK_CALL = 'QUICK_CALL', 'Quick Call'
    DATA_REVIEW = 'DATA_REVIEW', 'Data Review'
    RENEWAL = 'RENEWAL', 'Renewal'
    BUSINESS_REVIEW = 'BUSINESS_REVIEW', 'Business Review'
    REENGAGEMENT = 'REENGAGEMENT', 'Re-engagement'
    CUSTOM = 'CUSTOM', 'Custom'


class FollowUpRecurrence(models.TextChoices):
    NONE = 'NONE', 'None'
    DAILY = 'DAILY', 'Daily'
    WEEKLY = 'WEEKLY', 'Weekly'
    MONTHLY = 'MONTHLY', 'Monthly'


class FollowUpStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    SNOOZED = 'SNOOZED', 'Snoozed'
    COMPLETE = 'COMPLETE', 'Complete'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELED = 'CANCELED', 'Canceled'


ONBOARDING_STEP_FIELD_CHOICES = [('', 'No step'), *OnboardingStep.choices]


class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, unique=True, editable=False)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=SchoolStatus.choices, default=SchoolStatus.ACTIVE, db_index=True)
    details = models.JSONField(default=dict, blank=True)
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_schools',
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'schools'
        verbose_name = 'School'

    def save(self, *args, **kwargs):
        if not self.code:
            last_school = School.objects.order_by('id').last()
            if last_school:
                last_id = last_school.id
            else:
                last_id = 0
            self.code = f"SCH{last_id + 1:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Lead(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='lead_profile')
    stage = models.CharField(max_length=30, choices=LeadStage.choices, default=LeadStage.NEW, db_index=True)
    source = models.CharField(max_length=100, blank=True)
    priority = models.CharField(max_length=10, choices=LeadPriority.choices, default=LeadPriority.MEDIUM)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_leads',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_leads',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_leads',
    )
    notes = models.TextField(blank=True)
    loss_reason = models.TextField(blank=True)
    last_assigned_at = models.DateTimeField(null=True, blank=True)
    lost_at = models.DateTimeField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    conversion_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Lead for {self.school.name}"


class OnboardingProgress(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='onboarding_progress')
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboarding_assignments',
    )
    current_step = models.CharField(max_length=30, choices=OnboardingStep.choices, default=OnboardingStep.BASIC_INFO)
    completed_steps = models.JSONField(default=dict, blank=True)
    step_payloads = models.JSONField(default=dict, blank=True)
    blockers = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    handed_over_to_school_at = models.DateTimeField(null=True, blank=True)
    handed_over_by_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_onboarding_handoffs',
    )

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"Onboarding for {self.school.name}"


class SchoolTask(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='tasks')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    onboarding_progress = models.ForeignKey(
        OnboardingProgress,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tasks',
    )
    step = models.CharField(max_length=30, choices=ONBOARDING_STEP_FIELD_CHOICES, default='', blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='school_tasks',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_school_tasks',
    )
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING, db_index=True)
    is_required = models.BooleanField(default=True)
    due_at = models.DateTimeField(null=True, blank=True)
    blocked_reason = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_school_tasks',
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_at', '-created_at']

    def clean(self):
        if self.lead_id and self.lead.school_id != self.school_id:
            raise ValidationError({'lead': 'Lead must belong to the same school.'})
        if self.onboarding_progress_id and self.onboarding_progress.school_id != self.school_id:
            raise ValidationError({'onboarding_progress': 'Onboarding progress must belong to the same school.'})

    def __str__(self):
        return self.title


class ActivityLog(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='activity_logs')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    onboarding_progress = models.ForeignKey(
        OnboardingProgress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    task = models.ForeignKey(SchoolTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    action = models.CharField(max_length=100, db_index=True)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        if self.lead_id and self.lead.school_id != self.school_id:
            raise ValidationError({'lead': 'Lead must belong to the same school.'})
        if self.onboarding_progress_id and self.onboarding_progress.school_id != self.school_id:
            raise ValidationError({'onboarding_progress': 'Onboarding progress must belong to the same school.'})
        if self.task_id and self.task.school_id != self.school_id:
            raise ValidationError({'task': 'Task must belong to the same school.'})

    def __str__(self):
        return f"{self.action} - {self.school.name}"


class SchoolHealthSnapshot(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='health_snapshots')
    calculated_at = models.DateTimeField(auto_now_add=True, db_index=True)
    health_score = models.PositiveSmallIntegerField(default=0)
    engagement_score = models.PositiveSmallIntegerField(default=0)
    data_completeness_score = models.PositiveSmallIntegerField(default=0)
    payment_health_score = models.PositiveSmallIntegerField(default=0)
    account_health_score = models.PositiveSmallIntegerField(default=0)
    trend = models.CharField(max_length=20, choices=HealthTrend.choices, default=HealthTrend.STABLE)
    alerts = models.JSONField(default=list, blank=True)
    metrics = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-calculated_at']

    def __str__(self):
        return f"{self.school.name} health {self.health_score}"


class UpsellOpportunity(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='upsell_opportunities')
    trigger_type = models.CharField(max_length=100, db_index=True)
    recommended_action = models.TextField()
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    priority = models.PositiveSmallIntegerField(default=3)
    status = models.CharField(max_length=20, choices=OpportunityStatus.choices, default=OpportunityStatus.OPEN)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['priority', '-created_at']

    def __str__(self):
        return f"{self.school.name} - {self.trigger_type}"


class NotificationTemplate(models.Model):
    key = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    subject_template = models.CharField(max_length=255, blank=True)
    body_template = models.TextField()
    channels = models.JSONField(default=list, blank=True)
    schedule_type = models.CharField(
        max_length=20,
        choices=NotificationScheduleType.choices,
        default=NotificationScheduleType.IMMEDIATE,
    )
    variables = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['key']

    def __str__(self):
        return self.name


class FollowUp(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='follow_ups')
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='follow_ups')
    onboarding_progress = models.ForeignKey(
        OnboardingProgress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='follow_ups',
    )
    task = models.ForeignKey(SchoolTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='follow_ups')
    opportunity = models.ForeignKey(
        'UpsellOpportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='follow_ups',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_follow_ups',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_follow_ups',
    )
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_follow_ups',
    )
    escalated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalated_follow_ups',
    )
    communication_log = models.ForeignKey(
        'CommunicationLog',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='follow_ups',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    follow_up_type = models.CharField(max_length=30, choices=FollowUpType.choices, default=FollowUpType.CUSTOM)
    recurrence = models.CharField(max_length=20, choices=FollowUpRecurrence.choices, default=FollowUpRecurrence.NONE)
    status = models.CharField(max_length=20, choices=FollowUpStatus.choices, default=FollowUpStatus.PENDING, db_index=True)
    due_at = models.DateTimeField(db_index=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    escalated_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_at', '-created_at']

    def clean(self):
        if self.lead_id and self.lead.school_id != self.school_id:
            raise ValidationError({'lead': 'Lead must belong to the same school.'})
        if self.onboarding_progress_id and self.onboarding_progress.school_id != self.school_id:
            raise ValidationError({'onboarding_progress': 'Onboarding progress must belong to the same school.'})
        if self.task_id and self.task.school_id != self.school_id:
            raise ValidationError({'task': 'Task must belong to the same school.'})
        if self.opportunity_id and self.opportunity.school_id != self.school_id:
            raise ValidationError({'opportunity': 'Opportunity must belong to the same school.'})
        if self.communication_log_id and self.communication_log.school_id != self.school_id:
            raise ValidationError({'communication_log': 'Communication log must belong to the same school.'})

    def __str__(self):
        return self.title


class CommunicationLog(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='communications')
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='communications')
    onboarding_progress = models.ForeignKey(
        OnboardingProgress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communications',
    )
    task = models.ForeignKey(SchoolTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='communications')
    opportunity = models.ForeignKey(
        'UpsellOpportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communications',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_communications',
    )
    communication_type = models.CharField(max_length=20, choices=CommunicationType.choices, db_index=True)
    direction = models.CharField(max_length=20, choices=CommunicationDirection.choices, default=CommunicationDirection.OUTBOUND)
    participants = models.JSONField(default=list, blank=True)
    subject = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    attachments = models.JSONField(default=list, blank=True)
    occurred_at = models.DateTimeField(db_index=True)
    follow_up_required = models.BooleanField(default=False)
    follow_up_due_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-occurred_at', '-created_at']

    def clean(self):
        if self.lead_id and self.lead.school_id != self.school_id:
            raise ValidationError({'lead': 'Lead must belong to the same school.'})
        if self.onboarding_progress_id and self.onboarding_progress.school_id != self.school_id:
            raise ValidationError({'onboarding_progress': 'Onboarding progress must belong to the same school.'})
        if self.task_id and self.task.school_id != self.school_id:
            raise ValidationError({'task': 'Task must belong to the same school.'})
        if self.opportunity_id and self.opportunity.school_id != self.school_id:
            raise ValidationError({'opportunity': 'Opportunity must belong to the same school.'})
        if self.follow_up_required and not self.follow_up_due_at:
            raise ValidationError({'follow_up_due_at': 'Follow-up due date is required when follow-up is needed.'})

    def __str__(self):
        return self.subject or f"{self.communication_type} - {self.school.name}"


class NotificationRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='notifications')
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    onboarding_progress = models.ForeignKey(
        OnboardingProgress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    task = models.ForeignKey(SchoolTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    follow_up = models.ForeignKey(FollowUp, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    opportunity = models.ForeignKey(
        'UpsellOpportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    template_key = models.CharField(max_length=100, db_index=True)
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices, db_index=True)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=NotificationStatus.choices, default=NotificationStatus.PENDING, db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        if self.lead_id and self.lead.school_id != self.school_id:
            raise ValidationError({'lead': 'Lead must belong to the same school.'})
        if self.onboarding_progress_id and self.onboarding_progress.school_id != self.school_id:
            raise ValidationError({'onboarding_progress': 'Onboarding progress must belong to the same school.'})
        if self.task_id and self.task.school_id != self.school_id:
            raise ValidationError({'task': 'Task must belong to the same school.'})
        if self.follow_up_id and self.follow_up.school_id != self.school_id:
            raise ValidationError({'follow_up': 'Follow-up must belong to the same school.'})
        if self.opportunity_id and self.opportunity.school_id != self.school_id:
            raise ValidationError({'opportunity': 'Opportunity must belong to the same school.'})

    def __str__(self):
        return f"{self.template_key} - {self.channel}"