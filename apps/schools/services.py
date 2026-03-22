from copy import deepcopy
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import re

from django.core.exceptions import ValidationError
from django.db.models import Count, Max, Q, Sum
from django.db import transaction
from django.utils import timezone

from apps.attendance.models import Attendance
from apps.exams.models import Exam
from apps.fees.models import FeeBalance, PaymentTransaction
from apps.grading.models import Score
from apps.students.models import Class, Stream, Student
from apps.teachers.models import Teacher
from apps.users.models import User

from .models import (
    ActivityLog,
    CommunicationDirection,
    CommunicationLog,
    CommunicationType,
    FollowUp,
    FollowUpRecurrence,
    FollowUpStatus,
    FollowUpType,
    HealthTrend,
    Lead,
    LeadPriority,
    LeadStage,
    NotificationChannel,
    NotificationRecord,
    NotificationScheduleType,
    NotificationStatus,
    NotificationTemplate,
    OnboardingProgress,
    OnboardingStep,
    OpportunityStatus,
    School,
    SchoolHealthSnapshot,
    SchoolStatus,
    SchoolTask,
    TaskStatus,
    UpsellOpportunity,
)


logger = logging.getLogger(__name__)


ONBOARDING_STEP_SEQUENCE = [
    OnboardingStep.BASIC_INFO,
    OnboardingStep.PLAN_SELECTION,
    OnboardingStep.ADMIN_SETUP,
    OnboardingStep.DATA_IMPORT,
    OnboardingStep.CONFIGURATION,
    OnboardingStep.TRAINING,
    OnboardingStep.HANDBOOK,
]

VALID_LEAD_STAGE_TRANSITIONS = {
    LeadStage.NEW: {LeadStage.CONTACTED, LeadStage.LOST},
    LeadStage.CONTACTED: {LeadStage.DEMO_SCHEDULED, LeadStage.LOST},
    LeadStage.DEMO_SCHEDULED: {LeadStage.DEMO_COMPLETED, LeadStage.LOST},
    LeadStage.DEMO_COMPLETED: {LeadStage.NEGOTIATION, LeadStage.LOST},
    LeadStage.NEGOTIATION: {LeadStage.CONTRACT_SENT, LeadStage.LOST},
    LeadStage.CONTRACT_SENT: {LeadStage.WON, LeadStage.LOST},
    LeadStage.WON: set(),
    LeadStage.LOST: set(),
}

INITIAL_CONVERSION_TASK_BLUEPRINTS = [
    {
        'title': 'Complete basic school information',
        'step': OnboardingStep.BASIC_INFO,
        'due_in_days': 0,
        'description': 'Confirm the school profile, address, and primary contact details.',
    },
    {
        'title': 'Set up school admin account',
        'step': OnboardingStep.ADMIN_SETUP,
        'due_in_days': 0,
        'description': 'Provision the first school admin account and verify access requirements.',
    },
    {
        'title': 'Schedule training call',
        'step': OnboardingStep.TRAINING,
        'due_in_days': 3,
        'description': 'Arrange the initial training call with the school team.',
    },
]

DEFAULT_ONBOARDING_TASK_BLUEPRINTS = [
    {
        'title': 'Verify school contact information',
        'step': OnboardingStep.BASIC_INFO,
        'due_in_days': 2,
        'description': 'Review the primary school contact details for completeness and accuracy.',
    },
    {
        'title': 'Schedule admin account creation call',
        'step': OnboardingStep.ADMIN_SETUP,
        'due_in_days': 3,
        'description': 'Book time with the school team to create and verify admin access.',
    },
    {
        'title': 'Send data import template',
        'step': OnboardingStep.DATA_IMPORT,
        'due_in_days': 4,
        'description': 'Share the import template for students, teachers, and classes.',
    },
    {
        'title': 'Review imported data for accuracy',
        'step': OnboardingStep.DATA_IMPORT,
        'due_in_days': 7,
        'description': 'Validate imported academic and staff records before go-live.',
    },
    {
        'title': 'Schedule training session',
        'step': OnboardingStep.TRAINING,
        'due_in_days': 10,
        'description': 'Schedule live training for the school administrators and support staff.',
    },
]

STAFF_ROLE_CAPACITY_LIMITS = {
    'sales_rep': 50,
    'onboarding_specialist': 10,
    'account_manager': 100,
    'manager': None,
}

TRANSFER_REASONS = {
    'workload_balancing',
    'role_change',
    'staff_departure',
    'specialization',
}

TRANSFER_ITEM_OPTIONS = {
    'all_school_data',
    'active_tasks',
    'communication_history',
}

TRANSFER_ALLOWED_ROLES = {'manager', 'account_manager', 'onboarding_specialist'}

ROLE_CHANGE_STRATEGIES = {
    'auto_reassign',
    'keep_with_manager_approval',
    'complete_current_work',
}

FEATURE_MONITORING_KEYS = ('attendance', 'grading', 'billing', 'exams')
TEMPLATE_VARIABLE_PATTERN = re.compile(r'{{\s*(?P<key>[a-zA-Z0-9_]+)\s*}}')

DEFAULT_NOTIFICATION_TEMPLATES = {
    'new_lead_assigned': {
        'name': 'New lead assigned to you',
        'subject_template': 'New lead assigned: {{schoolName}}',
        'body_template': 'Hello {{staffName}}, a new lead for {{schoolName}} has been assigned to you.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName', 'staffName'],
    },
    'demo_scheduled': {
        'name': 'Demo scheduled',
        'subject_template': 'Demo scheduled for {{schoolName}}',
        'body_template': 'The demo for {{schoolName}} is now scheduled. Follow up with the school team as planned.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName'],
    },
    'lead_stage_changed': {
        'name': 'Lead stage changed',
        'subject_template': 'Lead stage updated for {{schoolName}}',
        'body_template': 'Lead stage for {{schoolName}} changed to {{stageName}}.',
        'channels': [NotificationChannel.IN_APP],
        'variables': ['schoolName', 'stageName'],
    },
    'lead_converted': {
        'name': 'Lead converted to school',
        'subject_template': '{{schoolName}} moved to onboarding',
        'body_template': '{{schoolName}} has been converted and onboarding is now active.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName'],
    },
    'onboarding_started': {
        'name': 'Onboarding started',
        'subject_template': 'Onboarding started for {{schoolName}}',
        'body_template': 'Onboarding has started for {{schoolName}}. Current step: {{currentStep}}.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName', 'currentStep'],
    },
    'onboarding_step_completed': {
        'name': 'Onboarding step completed',
        'subject_template': '{{stepName}} completed for {{schoolName}}',
        'body_template': 'The {{stepName}} onboarding step for {{schoolName}} has been completed.',
        'channels': [NotificationChannel.IN_APP],
        'variables': ['stepName', 'schoolName'],
    },
    'task_assigned': {
        'name': 'Task assigned',
        'subject_template': 'Task assigned: {{taskName}}',
        'body_template': 'You have been assigned the task "{{taskName}}" for {{schoolName}}.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['taskName', 'schoolName'],
    },
    'task_overdue': {
        'name': 'Task overdue',
        'subject_template': 'Overdue task: {{taskName}}',
        'body_template': 'The task "{{taskName}}" for {{schoolName}} is overdue.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['taskName', 'schoolName'],
    },
    'school_health_dropped': {
        'name': 'School health dropped',
        'subject_template': 'Health alert for {{schoolName}}',
        'body_template': '{{schoolName}} health score is {{healthScore}}. Review the account and follow up.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName', 'healthScore'],
    },
    'upsell_opportunity_detected': {
        'name': 'Upsell opportunity detected',
        'subject_template': 'Upsell opportunity for {{schoolName}}',
        'body_template': 'A new upsell opportunity was detected for {{schoolName}}: {{triggerType}}.',
        'channels': [NotificationChannel.IN_APP],
        'variables': ['schoolName', 'triggerType'],
    },
    'renewal_approaching': {
        'name': 'Renewal approaching',
        'subject_template': 'Renewal approaching for {{schoolName}}',
        'body_template': '{{schoolName}} renews in {{daysUntilRenewal}} days. Start the renewal conversation now.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName', 'daysUntilRenewal'],
    },
    'payment_failed': {
        'name': 'Payment failed',
        'subject_template': 'Payment issue for {{schoolName}}',
        'body_template': 'A payment issue was detected for {{schoolName}}. Please review the billing status.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName'],
    },
    'staff_role_changed': {
        'name': 'Staff role changed',
        'subject_template': 'Your role has changed to {{newRole}}',
        'body_template': 'Your platform role changed from {{previousRole}} to {{newRole}}.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['previousRole', 'newRole'],
    },
    'school_transferred': {
        'name': 'School transferred to you',
        'subject_template': '{{schoolName}} transferred to you',
        'body_template': '{{schoolName}} has been transferred to your portfolio.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName'],
    },
    'follow_up_due': {
        'name': 'Follow-up due',
        'subject_template': 'Follow-up due: {{followUpTitle}}',
        'body_template': 'Your follow-up "{{followUpTitle}}" for {{schoolName}} is due.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['followUpTitle', 'schoolName'],
    },
    'follow_up_escalated': {
        'name': 'Follow-up escalated',
        'subject_template': 'Escalated follow-up for {{schoolName}}',
        'body_template': 'A follow-up for {{schoolName}} was escalated because it is overdue.',
        'channels': [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        'variables': ['schoolName'],
    },
}


def _deep_merge_dict(base, updates):
    merged = deepcopy(base or {})
    for key, value in (updates or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def _score_from_ratio(ratio):
    ratio = max(0, min(float(ratio), 1))
    return round(ratio * 100)


def _score_from_days(days, *, good_days, warning_days):
    if days is None:
        return 0
    if days <= good_days:
        return 100
    if days <= warning_days:
        return 50
    return 0


def _round_score(value):
    return int(max(0, min(round(value), 100)))


def _score_from_payment_status(payment_status):
    normalized = normalize_role(payment_status)
    if normalized in {'active', 'paid', 'current'}:
        return 100
    if normalized in {'past_due', 'late', 'overdue'}:
        return 50
    if normalized in {'canceled', 'cancelled', 'suspended'}:
        return 0
    return 75


def _score_from_renewal_days(days_until_renewal):
    if days_until_renewal is None:
        return 70
    if days_until_renewal < 0:
        return 20
    if days_until_renewal <= 30:
        return 60
    if days_until_renewal <= 90:
        return 85
    return 100


def _get_school_users(school):
    return User.objects.filter(school=school)


def _get_school_admins(school):
    admin_roles = {'admin', 'schooladmin', 'school_admin', 'principal', 'headteacher'}
    users = _get_school_users(school)
    return [user for user in users if normalize_role(getattr(user, 'role', '')) in admin_roles]


def _serialize_health_snapshot(snapshot):
    return {
        'id': snapshot.id,
        'school_id': snapshot.school_id,
        'health_score': snapshot.health_score,
        'engagement_score': snapshot.engagement_score,
        'data_completeness_score': snapshot.data_completeness_score,
        'payment_health_score': snapshot.payment_health_score,
        'account_health_score': snapshot.account_health_score,
        'trend': snapshot.trend,
        'alerts': snapshot.alerts,
        'metrics': snapshot.metrics,
        'calculated_at': snapshot.calculated_at,
    }


def normalize_role(role):
    return str(role or '').strip().lower().replace('-', '_').replace(' ', '_')


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


def _get_active_user(user_id):
    try:
        return User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist as exc:
        raise ValidationError({'staff_id': 'Staff member was not found or is inactive.'}) from exc


def _get_user_capacity_limit(user):
    return STAFF_ROLE_CAPACITY_LIMITS.get(normalize_role(getattr(user, 'role', '')))


def _get_assignment_type_for_role(role):
    normalized_role = normalize_role(role)
    if normalized_role == 'sales_rep':
        return 'lead'
    if normalized_role == 'onboarding_specialist':
        return 'onboarding'
    if normalized_role == 'account_manager':
        return 'school'
    return 'oversight'


def _ensure_staff_role(user, allowed_roles, *, action_label):
    normalized_role = normalize_role(getattr(user, 'role', ''))
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return
    if normalized_role not in {normalize_role(role) for role in allowed_roles}:
        allowed = ', '.join(sorted({normalize_role(role) for role in allowed_roles}))
        raise ValidationError({'staff_id': f'Only staff with roles [{allowed}] can {action_label}.'})


def _ensure_manager_role(user, *, action_label):
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return
    if normalize_role(getattr(user, 'role', '')) != 'manager':
        raise ValidationError({'initiated_by_id': f'Only managers can {action_label}.'})


def _get_recent_assignment_at(user, assignment_type=None):
    assignment_type = assignment_type or _get_assignment_type_for_role(getattr(user, 'role', ''))
    if assignment_type == 'lead':
        latest_lead = Lead.objects.filter(assigned_to=user).order_by('-last_assigned_at', '-updated_at').first()
        return getattr(latest_lead, 'last_assigned_at', None) or getattr(latest_lead, 'updated_at', None)
    if assignment_type == 'onboarding':
        latest_progress = OnboardingProgress.objects.filter(assigned_to=user).order_by('-updated_at', '-started_at').first()
        return getattr(latest_progress, 'updated_at', None) or getattr(latest_progress, 'started_at', None)
    if assignment_type == 'school':
        latest_school = School.objects.filter(assigned_staff=user).order_by('-updated_at', '-created_at').first()
        return getattr(latest_school, 'updated_at', None) or getattr(latest_school, 'created_at', None)
    latest_school = School.objects.filter(assigned_staff=user).order_by('-updated_at').first()
    latest_lead = Lead.objects.filter(assigned_to=user).order_by('-last_assigned_at', '-updated_at').first()
    candidates = [
        getattr(latest_school, 'updated_at', None),
        getattr(latest_lead, 'last_assigned_at', None) or getattr(latest_lead, 'updated_at', None),
    ]
    candidates = [candidate for candidate in candidates if candidate is not None]
    return max(candidates) if candidates else None


def _serialize_lead_assignment(lead):
    return {
        'lead_id': lead.id,
        'school_id': lead.school_id,
        'school_name': lead.school.name,
        'stage': lead.stage,
        'assigned_to_id': lead.assigned_to_id,
    }


def _serialize_school_assignment(school):
    return {
        'school_id': school.id,
        'school_name': school.name,
        'status': school.status,
        'assigned_staff_id': school.assigned_staff_id,
    }


def _validate_role_change_strategy(strategy):
    normalized_strategy = normalize_role(strategy)
    if normalized_strategy not in ROLE_CHANGE_STRATEGIES:
        allowed = ', '.join(sorted(ROLE_CHANGE_STRATEGIES))
        raise ValidationError({'strategy': f'Role change strategy must be one of: {allowed}.'})
    return normalized_strategy


def _get_role_change_assignments(staff):
    active_leads = list(
        Lead.objects.select_related('school').filter(assigned_to=staff).exclude(stage__in=[LeadStage.WON, LeadStage.LOST])
    )
    onboarding_schools = list(
        School.objects.filter(assigned_staff=staff, status=SchoolStatus.ONBOARDING).order_by('name')
    )
    active_schools = list(
        School.objects.filter(assigned_staff=staff, status=SchoolStatus.ACTIVE).order_by('name')
    )
    return {
        'active_leads': active_leads,
        'onboarding_schools': onboarding_schools,
        'active_schools': active_schools,
    }


def _get_allowed_assignment_groups_for_role(role):
    normalized_role = normalize_role(role)
    if normalized_role == 'manager':
        return {'active_leads', 'onboarding_schools', 'active_schools'}
    if normalized_role == 'sales_rep':
        return {'active_leads'}
    if normalized_role == 'onboarding_specialist':
        return {'onboarding_schools'}
    if normalized_role == 'account_manager':
        return {'active_schools'}
    return set()


def _get_explicit_target_staff(target_staff_ids, key):
    target_id = (target_staff_ids or {}).get(key)
    return _get_active_user(target_id) if target_id else None


def _resolve_reassignment_target(*, assignment_group, target_staff_ids=None):
    explicit_targets = {
        'active_leads': 'lead_target_staff_id',
        'onboarding_schools': 'onboarding_target_staff_id',
        'active_schools': 'school_target_staff_id',
    }
    explicit_target = _get_explicit_target_staff(target_staff_ids, explicit_targets[assignment_group])
    if explicit_target:
        return explicit_target

    role_map = {
        'active_leads': ('sales_rep', 'lead'),
        'onboarding_schools': ('onboarding_specialist', 'onboarding'),
        'active_schools': ('account_manager', 'school'),
    }
    role, assignment_type = role_map[assignment_group]
    available = find_available_staff(role=role, assignment_type=assignment_type)
    return _get_active_user(available['staff_id'])


def _reassign_lead(*, lead, target_staff, initiated_by, notes=''):
    school = lead.school
    lead.assigned_to = target_staff
    lead.updated_by = initiated_by
    lead.last_assigned_at = timezone.now()
    lead.conversion_metadata = _deep_merge_dict(
        lead.conversion_metadata,
        {
            'role_change_reassignment': {
                'reassigned_at': timezone.now().isoformat(),
                'reassigned_by_id': initiated_by.id,
                'target_staff_id': target_staff.id,
                'notes': notes,
            }
        },
    )
    _save_with_validation(lead)
    if school.status == SchoolStatus.LEAD:
        school.assigned_staff = target_staff
        school.details = _deep_merge_dict(
            school.details,
            {
                'role_change_reassignment': {
                    'reassigned_at': timezone.now().isoformat(),
                    'reassigned_by_id': initiated_by.id,
                    'target_staff_id': target_staff.id,
                }
            },
        )
        _save_with_validation(school)

    log_activity(
        school=school,
        actor=initiated_by,
        action='lead_reassigned_for_role_change',
        description=f'Lead reassigned to {target_staff.full_name or target_staff.email} during role change.',
        metadata={'lead_id': lead.id, 'target_staff_id': target_staff.id, 'notes': notes},
        lead=lead,
    )


def _log_role_change_keep(*, school, initiated_by, staff, new_role, strategy):
    log_activity(
        school=school,
        actor=initiated_by,
        action='role_change_assignment_kept',
        description=f'{staff.full_name or staff.email} kept assignment during role change to {new_role}.',
        metadata={'staff_id': staff.id, 'new_role': new_role, 'strategy': strategy},
    )


def get_role_change_impact(*, staff_id, new_role):
    staff = _get_active_user(staff_id)
    new_role = normalize_role(new_role)
    assignments = _get_role_change_assignments(staff)
    allowed_groups = _get_allowed_assignment_groups_for_role(new_role)

    mismatched_leads = assignments['active_leads'] if 'active_leads' not in allowed_groups else []
    mismatched_onboarding_schools = assignments['onboarding_schools'] if 'onboarding_schools' not in allowed_groups else []
    mismatched_active_schools = assignments['active_schools'] if 'active_schools' not in allowed_groups else []

    return {
        'staff_id': staff.id,
        'staff_name': staff.full_name or staff.email,
        'current_role': normalize_role(staff.role),
        'new_role': new_role,
        'current_assignments': {
            'active_leads': [_serialize_lead_assignment(lead) for lead in assignments['active_leads']],
            'onboarding_schools': [_serialize_school_assignment(school) for school in assignments['onboarding_schools']],
            'active_schools': [_serialize_school_assignment(school) for school in assignments['active_schools']],
        },
        'mismatched_assignments': {
            'active_leads': [_serialize_lead_assignment(lead) for lead in mismatched_leads],
            'onboarding_schools': [_serialize_school_assignment(school) for school in mismatched_onboarding_schools],
            'active_schools': [_serialize_school_assignment(school) for school in mismatched_active_schools],
        },
        'summary': {
            'active_lead_count': len(assignments['active_leads']),
            'onboarding_school_count': len(assignments['onboarding_schools']),
            'active_school_count': len(assignments['active_schools']),
            'mismatched_lead_count': len(mismatched_leads),
            'mismatched_onboarding_school_count': len(mismatched_onboarding_schools),
            'mismatched_active_school_count': len(mismatched_active_schools),
        },
    }


def _get_step_index(step):
    try:
        return ONBOARDING_STEP_SEQUENCE.index(step)
    except ValueError as exc:
        raise ValidationError({'step': 'Invalid onboarding step.'}) from exc


def _get_next_step(completed_steps):
    completed = set(completed_steps.keys())
    for step in ONBOARDING_STEP_SEQUENCE:
        if step not in completed:
            return step
    return OnboardingStep.HANDBOOK


def _step_has_pending_required_tasks(progress, step):
    return SchoolTask.objects.filter(
        school=progress.school,
        onboarding_progress=progress,
        step=step,
        is_required=True,
    ).exclude(status=TaskStatus.COMPLETE).exists()


def _determine_current_step(progress):
    completed_steps = progress.completed_steps or {}
    for step in ONBOARDING_STEP_SEQUENCE:
        if step not in completed_steps or _step_has_pending_required_tasks(progress, step):
            return step
    return OnboardingStep.HANDBOOK


def _sync_progress_completion(progress):
    progress.current_step = _determine_current_step(progress)
    all_steps_complete = all(step in (progress.completed_steps or {}) for step in ONBOARDING_STEP_SEQUENCE)
    has_pending_required_tasks = SchoolTask.objects.filter(
        school=progress.school,
        onboarding_progress=progress,
        is_required=True,
    ).exclude(status=TaskStatus.COMPLETE).exists()
    progress.completed_at = timezone.now() if all_steps_complete and not has_pending_required_tasks else None
    _save_with_validation(progress)
    return progress


def log_activity(*, school, actor=None, action, description, metadata=None, lead=None, onboarding_progress=None, task=None):
    _validate_school_scope(
        school=school,
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    entry = ActivityLog(
        school=school,
        actor=actor,
        action=action,
        description=description,
        metadata=metadata or {},
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    return _save_with_validation(entry)


def _get_notification_preferences(user):
    preferences = getattr(user, 'notification_preferences', {}) or {}
    return {
        'in_app_enabled': preferences.get('in_app_enabled', True),
        'email_enabled': preferences.get('email_enabled', bool(getattr(user, 'email', ''))),
        'sms_enabled': preferences.get('sms_enabled', False),
        'digest_preference': preferences.get('digest_preference', NotificationScheduleType.IMMEDIATE),
    }


def _render_template_text(template_text, variables=None):
    variables = variables or {}

    def replace(match):
        key = match.group('key')
        value = variables.get(key, '')
        return '' if value is None else str(value)

    return TEMPLATE_VARIABLE_PATTERN.sub(replace, template_text or '')


def _get_default_template_payload(template_key):
    if template_key not in DEFAULT_NOTIFICATION_TEMPLATES:
        raise ValidationError({'template_key': f'Unknown notification template: {template_key}.'})
    payload = DEFAULT_NOTIFICATION_TEMPLATES[template_key]
    return {
        'name': payload['name'],
        'subject_template': payload.get('subject_template', ''),
        'body_template': payload['body_template'],
        'channels': payload.get('channels', [NotificationChannel.IN_APP]),
        'schedule_type': payload.get('schedule_type', NotificationScheduleType.IMMEDIATE),
        'variables': payload.get('variables', []),
        'metadata': payload.get('metadata', {}),
        'is_active': True,
    }


def ensure_notification_template(*, template_key):
    defaults = _get_default_template_payload(template_key)
    template, _created = NotificationTemplate.objects.get_or_create(key=template_key, defaults=defaults)
    return template


def ensure_default_notification_templates():
    return [ensure_notification_template(template_key=template_key) for template_key in DEFAULT_NOTIFICATION_TEMPLATES]


def preview_notification_template(*, template_key, variables=None):
    template = ensure_notification_template(template_key=template_key)
    variables = variables or {}
    return {
        'template_key': template.key,
        'name': template.name,
        'subject': _render_template_text(template.subject_template, variables),
        'body': _render_template_text(template.body_template, variables),
        'channels': template.channels,
        'schedule_type': template.schedule_type,
    }


def _resolve_notification_schedule(*, template, recipient, schedule_for=None):
    if schedule_for:
        return schedule_for
    preferences = _get_notification_preferences(recipient)
    schedule_type = template.schedule_type
    if preferences['digest_preference'] == NotificationScheduleType.DIGEST:
        schedule_type = NotificationScheduleType.DIGEST
    if schedule_type == NotificationScheduleType.DIGEST:
        digest_time = timezone.now() + timedelta(days=1)
        return digest_time.replace(hour=8, minute=0, second=0, microsecond=0)
    return timezone.now()


def _is_channel_enabled_for_user(*, user, channel):
    preferences = _get_notification_preferences(user)
    if channel == NotificationChannel.IN_APP:
        return preferences['in_app_enabled']
    if channel == NotificationChannel.EMAIL:
        return preferences['email_enabled'] and bool(getattr(user, 'email', ''))
    if channel == NotificationChannel.SMS:
        return preferences['sms_enabled'] and bool(getattr(user, 'phone', ''))
    return False


@transaction.atomic
def send_notification(
    *,
    school,
    recipient,
    template_key,
    variables=None,
    channels=None,
    subject_override='',
    body_override='',
    schedule_for=None,
    lead=None,
    onboarding_progress=None,
    task=None,
    follow_up=None,
    opportunity=None,
    metadata=None,
):
    _validate_school_scope(
        school=school,
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    if follow_up is not None and follow_up.school_id != school.id:
        raise ValidationError({'follow_up': 'Follow-up must belong to the same school.'})
    if opportunity is not None and opportunity.school_id != school.id:
        raise ValidationError({'opportunity': 'Opportunity must belong to the same school.'})

    template = ensure_notification_template(template_key=template_key)
    if not template.is_active:
        raise ValidationError({'template_key': 'Notification template is inactive.'})

    variables = variables or {}
    subject = subject_override if subject_override else _render_template_text(template.subject_template, variables)
    body = body_override if body_override else _render_template_text(template.body_template, variables)
    selected_channels = channels or template.channels or [NotificationChannel.IN_APP]
    selected_channels = [str(channel) for channel in selected_channels]
    created_notifications = []
    scheduled_for_value = _resolve_notification_schedule(template=template, recipient=recipient, schedule_for=schedule_for)

    for channel in selected_channels:
        if not _is_channel_enabled_for_user(user=recipient, channel=channel):
            continue
        status = NotificationStatus.SENT if scheduled_for_value <= timezone.now() else NotificationStatus.SCHEDULED
        notification = NotificationRecord(
            school=school,
            recipient=recipient,
            template=template,
            template_key=template_key,
            channel=channel,
            subject=subject,
            body=body,
            status=status,
            scheduled_for=scheduled_for_value,
            sent_at=timezone.now() if status == NotificationStatus.SENT else None,
            lead=lead,
            onboarding_progress=onboarding_progress,
            task=task,
            follow_up=follow_up,
            opportunity=opportunity,
            metadata=metadata or {},
        )
        _save_with_validation(notification)
        created_notifications.append(notification)

    return created_notifications


def _serialize_notification(notification):
    return {
        'id': notification.id,
        'school_id': notification.school_id,
        'recipient_id': notification.recipient_id,
        'template_key': notification.template_key,
        'channel': notification.channel,
        'subject': notification.subject,
        'body': notification.body,
        'status': notification.status,
        'scheduled_for': notification.scheduled_for,
        'sent_at': notification.sent_at,
        'read_at': notification.read_at,
        'metadata': notification.metadata,
    }


def _serialize_follow_up(follow_up):
    return {
        'id': follow_up.id,
        'school_id': follow_up.school_id,
        'title': follow_up.title,
        'description': follow_up.description,
        'follow_up_type': follow_up.follow_up_type,
        'status': follow_up.status,
        'recurrence': follow_up.recurrence,
        'assigned_to_id': follow_up.assigned_to_id,
        'due_at': follow_up.due_at,
        'snoozed_until': follow_up.snoozed_until,
        'completed_at': follow_up.completed_at,
        'escalated_at': follow_up.escalated_at,
        'metadata': follow_up.metadata,
    }


@transaction.atomic
def create_follow_up(
    *,
    school,
    created_by,
    title,
    due_at,
    description='',
    assigned_to=None,
    lead=None,
    onboarding_progress=None,
    task=None,
    communication_log=None,
    opportunity=None,
    follow_up_type=FollowUpType.CUSTOM,
    recurrence=FollowUpRecurrence.NONE,
    metadata=None,
):
    _validate_school_scope(school=school, lead=lead, onboarding_progress=onboarding_progress, task=task)
    if communication_log is not None and communication_log.school_id != school.id:
        raise ValidationError({'communication_log': 'Communication log must belong to the same school.'})
    if opportunity is not None and opportunity.school_id != school.id:
        raise ValidationError({'opportunity': 'Opportunity must belong to the same school.'})

    follow_up = FollowUp(
        school=school,
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
        communication_log=communication_log,
        opportunity=opportunity,
        created_by=created_by,
        assigned_to=assigned_to or created_by or school.assigned_staff,
        title=title,
        description=description,
        follow_up_type=follow_up_type,
        recurrence=recurrence,
        due_at=due_at,
        metadata=metadata or {},
    )
    _save_with_validation(follow_up)
    log_activity(
        school=school,
        actor=created_by,
        action='follow_up_created',
        description=f'Follow-up "{title}" created for {school.name}.',
        metadata={'follow_up_id': follow_up.id, 'follow_up_type': follow_up.follow_up_type},
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    return follow_up


@transaction.atomic
def log_communication(
    *,
    school_id,
    actor_id,
    communication_type,
    content,
    direction=CommunicationDirection.OUTBOUND,
    participants=None,
    subject='',
    attachments=None,
    occurred_at=None,
    follow_up_required=False,
    follow_up_due_at=None,
    follow_up_title='',
    follow_up_description='',
    follow_up_assigned_to_id=None,
    lead_id=None,
    onboarding_progress_id=None,
    task_id=None,
    opportunity_id=None,
    metadata=None,
):
    actor = _get_active_user(actor_id)
    try:
        school = School.objects.select_for_update().get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    lead = Lead.objects.filter(pk=lead_id).first() if lead_id else None
    onboarding_progress = OnboardingProgress.objects.filter(pk=onboarding_progress_id).first() if onboarding_progress_id else None
    task = SchoolTask.objects.filter(pk=task_id).first() if task_id else None
    opportunity = UpsellOpportunity.objects.filter(pk=opportunity_id).first() if opportunity_id else None
    _validate_school_scope(school=school, lead=lead, onboarding_progress=onboarding_progress, task=task)
    if opportunity is not None and opportunity.school_id != school.id:
        raise ValidationError({'opportunity_id': 'Opportunity must belong to the same school.'})
    if follow_up_required and not follow_up_due_at:
        raise ValidationError({'follow_up_due_at': 'Follow-up due date is required.'})

    communication = CommunicationLog(
        school=school,
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
        opportunity=opportunity,
        created_by=actor,
        communication_type=communication_type,
        direction=direction,
        participants=participants or [],
        subject=subject,
        content=content,
        attachments=attachments or [],
        occurred_at=occurred_at or timezone.now(),
        follow_up_required=follow_up_required,
        follow_up_due_at=follow_up_due_at,
        metadata=metadata or {},
    )
    _save_with_validation(communication)

    follow_up = None
    if follow_up_required:
        follow_up_assigned_to = _get_active_user(follow_up_assigned_to_id) if follow_up_assigned_to_id else (school.assigned_staff or actor)
        follow_up = create_follow_up(
            school=school,
            created_by=actor,
            title=follow_up_title or subject or 'Communication follow-up',
            description=follow_up_description or content[:255],
            assigned_to=follow_up_assigned_to,
            lead=lead,
            onboarding_progress=onboarding_progress,
            task=task,
            communication_log=communication,
            opportunity=opportunity,
            due_at=follow_up_due_at,
            follow_up_type=FollowUpType.CUSTOM,
            metadata={'auto_created_from_communication': True},
        )

    log_activity(
        school=school,
        actor=actor,
        action='communication_logged',
        description=f'Communication logged for {school.name}: {communication.communication_type}.',
        metadata={'communication_id': communication.id, 'follow_up_id': follow_up.id if follow_up else None},
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    return communication, follow_up


def get_communication_timeline(*, school_id=None, actor_id=None, communication_type=None, keyword='', start_date=None, end_date=None):
    queryset = CommunicationLog.objects.select_related('school', 'created_by', 'lead', 'onboarding_progress', 'task', 'opportunity')
    if school_id:
        queryset = queryset.filter(school_id=school_id)
    if actor_id:
        queryset = queryset.filter(created_by_id=actor_id)
    if communication_type:
        queryset = queryset.filter(communication_type=communication_type)
    if keyword:
        queryset = queryset.filter(Q(subject__icontains=keyword) | Q(content__icontains=keyword))
    if start_date:
        queryset = queryset.filter(occurred_at__gte=start_date)
    if end_date:
        queryset = queryset.filter(occurred_at__lte=end_date)
    return list(queryset.order_by('-occurred_at', '-created_at'))


def get_notification_records(*, school_id=None, recipient_id=None, channel=None, status=None, unread_only=False):
    queryset = NotificationRecord.objects.select_related('school', 'recipient', 'template', 'lead', 'task', 'follow_up')
    if school_id:
        queryset = queryset.filter(school_id=school_id)
    if recipient_id:
        queryset = queryset.filter(recipient_id=recipient_id)
    if channel:
        queryset = queryset.filter(channel=channel)
    if status:
        queryset = queryset.filter(status=status)
    if unread_only:
        queryset = queryset.filter(read_at__isnull=True)
    return list(queryset.order_by('-created_at'))


def get_follow_up_list(*, school_id=None, assigned_to_id=None, status=None, due_today=False, overdue=False):
    queryset = FollowUp.objects.select_related('school', 'assigned_to', 'lead', 'task', 'communication_log')
    if school_id:
        queryset = queryset.filter(school_id=school_id)
    if assigned_to_id:
        queryset = queryset.filter(assigned_to_id=assigned_to_id)
    if status:
        queryset = queryset.filter(status=status)
    if due_today:
        today = timezone.localdate()
        queryset = queryset.filter(due_at__date=today)
    if overdue:
        queryset = queryset.exclude(status__in=[FollowUpStatus.COMPLETE, FollowUpStatus.CANCELED]).filter(due_at__lt=timezone.now())
    return list(queryset.order_by('due_at', '-created_at'))


@transaction.atomic
def snooze_follow_up(*, follow_up_id, actor_id, days):
    actor = _get_active_user(actor_id)
    try:
        follow_up = FollowUp.objects.select_for_update().select_related('school', 'lead', 'onboarding_progress', 'task').get(pk=follow_up_id)
    except FollowUp.DoesNotExist as exc:
        raise ValidationError({'follow_up_id': 'Follow-up was not found.'}) from exc

    new_due_at = max(follow_up.due_at, timezone.now()) + timedelta(days=days)
    follow_up.due_at = new_due_at
    follow_up.snoozed_until = new_due_at
    follow_up.status = FollowUpStatus.SNOOZED
    follow_up.metadata = _deep_merge_dict(follow_up.metadata, {'last_snoozed_by_id': actor.id, 'last_snooze_days': days})
    _save_with_validation(follow_up)
    log_activity(
        school=follow_up.school,
        actor=actor,
        action='follow_up_snoozed',
        description=f'Follow-up "{follow_up.title}" snoozed by {days} day(s).',
        metadata={'follow_up_id': follow_up.id, 'days': days},
        lead=follow_up.lead,
        onboarding_progress=follow_up.onboarding_progress,
        task=follow_up.task,
    )
    return follow_up


@transaction.atomic
def complete_follow_up(*, follow_up_id, actor_id, notes=''):
    actor = _get_active_user(actor_id)
    try:
        follow_up = FollowUp.objects.select_for_update().select_related('school', 'lead', 'onboarding_progress', 'task').get(pk=follow_up_id)
    except FollowUp.DoesNotExist as exc:
        raise ValidationError({'follow_up_id': 'Follow-up was not found.'}) from exc

    follow_up.status = FollowUpStatus.COMPLETE
    follow_up.completed_at = timezone.now()
    follow_up.completed_by = actor
    if notes:
        follow_up.metadata = _deep_merge_dict(follow_up.metadata, {'completion_notes': notes})
    _save_with_validation(follow_up)
    log_activity(
        school=follow_up.school,
        actor=actor,
        action='follow_up_completed',
        description=f'Follow-up "{follow_up.title}" marked complete.',
        metadata={'follow_up_id': follow_up.id, 'notes': notes},
        lead=follow_up.lead,
        onboarding_progress=follow_up.onboarding_progress,
        task=follow_up.task,
    )
    return follow_up


def get_todays_follow_ups(*, staff_id):
    return get_follow_up_list(assigned_to_id=staff_id, due_today=True)


@transaction.atomic
def process_due_follow_ups(*, actor_id=None):
    actor = _get_active_user(actor_id) if actor_id else None
    now = timezone.now()
    processed_ids = []
    escalated_ids = []

    due_follow_ups = FollowUp.objects.select_for_update().select_related('school', 'assigned_to', 'lead', 'onboarding_progress', 'task').exclude(
        status__in=[FollowUpStatus.COMPLETE, FollowUpStatus.CANCELED]
    ).filter(due_at__lte=now)

    for follow_up in due_follow_ups:
        if follow_up.status != FollowUpStatus.COMPLETE:
            follow_up.status = FollowUpStatus.OVERDUE if follow_up.due_at < now else FollowUpStatus.PENDING
            _save_with_validation(follow_up)

        existing_due_notification = NotificationRecord.objects.filter(
            follow_up=follow_up,
            template_key='follow_up_due',
        ).exclude(status=NotificationStatus.FAILED).exists()
        if follow_up.assigned_to and not existing_due_notification:
            send_notification(
                school=follow_up.school,
                recipient=follow_up.assigned_to,
                template_key='follow_up_due',
                follow_up=follow_up,
                lead=follow_up.lead,
                onboarding_progress=follow_up.onboarding_progress,
                task=follow_up.task,
                variables={
                    'followUpTitle': follow_up.title,
                    'schoolName': follow_up.school.name,
                },
                metadata={'automated': True},
            )
        processed_ids.append(follow_up.id)

        if follow_up.due_at <= now - timedelta(days=3) and not follow_up.escalated_at:
            manager = User.objects.filter(is_active=True, school__isnull=True).filter(Q(is_staff=True) | Q(is_superuser=True) | Q(role__iexact='manager')).order_by('id').first()
            if manager:
                follow_up.escalated_at = now
                follow_up.escalated_to = manager
                _save_with_validation(follow_up)
                send_notification(
                    school=follow_up.school,
                    recipient=manager,
                    template_key='follow_up_escalated',
                    follow_up=follow_up,
                    lead=follow_up.lead,
                    onboarding_progress=follow_up.onboarding_progress,
                    task=follow_up.task,
                    variables={'schoolName': follow_up.school.name},
                    metadata={'automated': True, 'escalated_follow_up_id': follow_up.id},
                )
                escalated_ids.append(follow_up.id)
                log_activity(
                    school=follow_up.school,
                    actor=actor,
                    action='follow_up_escalated',
                    description=f'Follow-up "{follow_up.title}" escalated to manager.',
                    metadata={'follow_up_id': follow_up.id, 'manager_id': manager.id},
                    lead=follow_up.lead,
                    onboarding_progress=follow_up.onboarding_progress,
                    task=follow_up.task,
                )

    return {
        'processed_follow_up_ids': processed_ids,
        'escalated_follow_up_ids': escalated_ids,
    }


def _calculate_health_trend(*, school):
    latest_two = list(SchoolHealthSnapshot.objects.filter(school=school).order_by('-calculated_at')[:2])
    if len(latest_two) < 2:
        return HealthTrend.STABLE, None
    change = latest_two[0].health_score - latest_two[1].health_score
    if change >= 5:
        return HealthTrend.IMPROVING, change
    if change <= -5:
        return HealthTrend.DECLINING, change
    return HealthTrend.STABLE, change


@transaction.atomic
def calculate_school_health_score(*, school_id, actor_id=None):
    try:
        school = School.objects.select_for_update().get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    actor = _get_active_user(actor_id) if actor_id else None
    school_users = _get_school_users(school)
    total_users = school_users.count()
    last_login = school_users.aggregate(last_login=Max('last_login'))['last_login']
    days_since_last_login = (timezone.now() - last_login).days if last_login else None
    active_users = school_users.filter(last_login__gte=timezone.now() - timedelta(days=30)).count()
    active_user_ratio = (active_users / total_users) if total_users else 0

    recent_attendance = Attendance._base_manager.filter(school=school, date__gte=timezone.localdate() - timedelta(days=30)).count()
    recent_scores = Score.objects.filter(student__school=school, created_at__gte=timezone.now() - timedelta(days=30)).count()
    recent_exams = Exam.objects.filter(school=school, created_at__gte=timezone.now() - timedelta(days=30)).count()
    recent_payments = PaymentTransaction._base_manager.filter(school=school, date__gte=timezone.now() - timedelta(days=30)).count()
    feature_usage = {
        'attendance': recent_attendance > 0,
        'grading': recent_scores > 0,
        'billing': recent_payments > 0,
        'exams': recent_exams > 0,
    }
    features_used_ratio = sum(1 for used in feature_usage.values() if used) / len(FEATURE_MONITORING_KEYS)
    support_signal_count = SchoolTask.objects.filter(school=school, created_at__gte=timezone.now() - timedelta(days=30)).count()
    support_score = 60 if support_signal_count == 0 else 100 if support_signal_count <= 10 else 40
    engagement_components = [
        _score_from_days(days_since_last_login, good_days=30, warning_days=60),
        _score_from_ratio(active_user_ratio),
        _score_from_ratio(features_used_ratio),
        support_score,
    ]
    engagement_score = _round_score(sum(engagement_components) / len(engagement_components))

    students = Student._base_manager.filter(school=school, is_active=True)
    total_students = students.count()
    complete_students = students.filter(
        guardian_name__gt='',
        guardian_phone__gt='',
        current_class__isnull=False,
        current_stream__isnull=False,
    ).count()
    student_completeness_ratio = (complete_students / total_students) if total_students else 0

    teachers = Teacher.objects.filter(school=school, is_active=True)
    total_teachers = teachers.count()
    complete_teachers = teachers.filter(email__gt='', phone__gt='', job_title__gt='').count()
    teacher_completeness_ratio = (complete_teachers / total_teachers) if total_teachers else 0

    class_count = Class.objects.filter(school=school).count()
    stream_count = Stream.objects.filter(school=school).count()
    structure_score = 100 if class_count > 0 and stream_count > 0 else 50 if class_count > 0 else 0
    attendance_score = 100 if recent_attendance > 0 else 0
    grading_score = 100 if recent_scores > 0 else 0
    data_components = [
        _score_from_ratio(student_completeness_ratio),
        _score_from_ratio(teacher_completeness_ratio),
        structure_score,
        attendance_score,
        grading_score,
    ]
    data_completeness_score = _round_score(sum(data_components) / len(data_components))

    billing_details = (school.details or {}).get('billing', {})
    payment_status_score = _score_from_payment_status(billing_details.get('payment_status', 'active'))
    renewal_date = billing_details.get('renewal_date')
    days_until_renewal = None
    if renewal_date:
        try:
            renewal_dt = datetime.fromisoformat(renewal_date)
            if timezone.is_naive(renewal_dt):
                renewal_dt = timezone.make_aware(renewal_dt, timezone.get_current_timezone())
            days_until_renewal = (renewal_dt - timezone.now()).days
        except ValueError:
            days_until_renewal = None
    renewal_score = _score_from_renewal_days(days_until_renewal)
    payment_method_valid_score = 100 if billing_details.get('payment_method_valid', True) else 0
    outstanding_balance = FeeBalance.objects.filter(school=school).aggregate(total=Sum('closing_balance'))['total'] or Decimal('0')
    outstanding_balance_score = 100 if outstanding_balance <= 0 else 60 if outstanding_balance < Decimal('100000') else 30
    payment_components = [payment_status_score, renewal_score, payment_method_valid_score, outstanding_balance_score]
    payment_health_score = _round_score(sum(payment_components) / len(payment_components))

    school_admins = _get_school_admins(school)
    designated_admin_score = 100 if school_admins else 0
    recent_admin_login_score = 0
    if school_admins:
        recent_admin_login = max((admin.last_login for admin in school_admins if admin.last_login), default=None)
        recent_admin_login_score = _score_from_days(
            (timezone.now() - recent_admin_login).days if recent_admin_login else None,
            good_days=14,
            warning_days=30,
        )
    training_completed = False
    onboarding_progress = OnboardingProgress.objects.filter(school=school).first()
    if onboarding_progress:
        training_completed = OnboardingStep.TRAINING in (onboarding_progress.completed_steps or {})
    training_score = 100 if training_completed else 0
    account_components = [designated_admin_score, recent_admin_login_score, training_score]
    account_health_score = _round_score(sum(account_components) / len(account_components))

    weighted_score = (
        (engagement_score * 0.4)
        + (data_completeness_score * 0.3)
        + (payment_health_score * 0.2)
        + (account_health_score * 0.1)
    )
    health_score = _round_score(weighted_score)

    alerts = []
    if health_score < 50:
        alerts.append({'type': 'at_risk', 'message': 'Health score below 50.'})
    trend, score_change = _calculate_health_trend(school=school)
    if score_change is not None and score_change <= -20:
        alerts.append({'type': 'decline', 'message': 'Health score dropped 20 or more points.'})
    if health_score > 90:
        alerts.append({'type': 'upsell', 'message': 'High satisfaction detected.'})

    snapshot = SchoolHealthSnapshot(
        school=school,
        health_score=health_score,
        engagement_score=engagement_score,
        data_completeness_score=data_completeness_score,
        payment_health_score=payment_health_score,
        account_health_score=account_health_score,
        trend=trend,
        alerts=alerts,
        metrics={
            'days_since_last_login': days_since_last_login,
            'active_user_ratio': active_user_ratio,
            'features_used_ratio': features_used_ratio,
            'support_signal_count': support_signal_count,
            'student_completeness_ratio': student_completeness_ratio,
            'teacher_completeness_ratio': teacher_completeness_ratio,
            'class_count': class_count,
            'stream_count': stream_count,
            'recent_attendance_count': recent_attendance,
            'recent_score_count': recent_scores,
            'recent_exam_count': recent_exams,
            'recent_payment_count': recent_payments,
            'payment_status': billing_details.get('payment_status', 'active'),
            'days_until_renewal': days_until_renewal,
            'payment_method_valid': billing_details.get('payment_method_valid', True),
            'outstanding_balance': str(outstanding_balance),
            'designated_admin_count': len(school_admins),
            'training_completed': training_completed,
        },
    )
    _save_with_validation(snapshot)

    log_activity(
        school=school,
        actor=actor,
        action='school_health_calculated',
        description=f'Health score calculated for {school.name}: {health_score}.',
        metadata={'snapshot_id': snapshot.id, 'health_score': health_score, 'trend': trend, 'alerts': alerts},
        onboarding_progress=onboarding_progress,
    )
    previous_snapshot = SchoolHealthSnapshot.objects.filter(school=school).exclude(pk=snapshot.id).order_by('-calculated_at').first()
    if school.assigned_staff and (health_score < 50 or (previous_snapshot and (health_score - previous_snapshot.health_score) <= -20)):
        send_notification(
            school=school,
            recipient=school.assigned_staff,
            template_key='school_health_dropped',
            onboarding_progress=onboarding_progress,
            variables={'schoolName': school.name, 'healthScore': health_score},
            metadata={'snapshot_id': snapshot.id, 'auto_generated': True},
        )
        create_follow_up(
            school=school,
            created_by=actor or school.assigned_staff,
            assigned_to=school.assigned_staff,
            onboarding_progress=onboarding_progress,
            title=f'Weekly health check-in for {school.name}',
            description='Reach out to the school and review the latest health concerns.',
            due_at=timezone.now() + timedelta(days=7),
            follow_up_type=FollowUpType.QUICK_CALL,
            recurrence=FollowUpRecurrence.WEEKLY,
            metadata={'trigger': 'low_health_score', 'snapshot_id': snapshot.id},
        )
    if days_until_renewal is not None and 0 <= days_until_renewal <= 30:
        recipients = [school.assigned_staff] if school.assigned_staff else []
        recipients.extend(_get_school_admins(school))
        for recipient in {recipient for recipient in recipients if recipient is not None}:
            send_notification(
                school=school,
                recipient=recipient,
                template_key='renewal_approaching',
                onboarding_progress=onboarding_progress,
                variables={'schoolName': school.name, 'daysUntilRenewal': days_until_renewal},
                metadata={'snapshot_id': snapshot.id, 'auto_generated': True},
            )
    if normalize_role(billing_details.get('payment_status')) in {'past_due', 'late', 'overdue', 'failed'}:
        recipients = [school.assigned_staff] if school.assigned_staff else []
        recipients.extend(_get_school_admins(school))
        for recipient in {recipient for recipient in recipients if recipient is not None}:
            send_notification(
                school=school,
                recipient=recipient,
                template_key='payment_failed',
                onboarding_progress=onboarding_progress,
                variables={'schoolName': school.name},
                metadata={'snapshot_id': snapshot.id, 'auto_generated': True},
            )
    return snapshot


def get_school_health_overview(*, school_id):
    try:
        school = School.objects.get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    latest_snapshot = SchoolHealthSnapshot.objects.filter(school=school).order_by('-calculated_at').first()
    if not latest_snapshot:
        latest_snapshot = calculate_school_health_score(school_id=school.id)
    historical = list(SchoolHealthSnapshot.objects.filter(school=school).order_by('-calculated_at')[:10])
    return {
        'school_id': school.id,
        'school_name': school.name,
        'latest_snapshot': _serialize_health_snapshot(latest_snapshot),
        'history': [_serialize_health_snapshot(snapshot) for snapshot in historical],
    }


@transaction.atomic
def identify_at_risk_schools(*, actor_id=None):
    actor = _get_active_user(actor_id) if actor_id else None
    at_risk_results = []
    for school in School.objects.exclude(status=SchoolStatus.CHURNED):
        snapshot = SchoolHealthSnapshot.objects.filter(school=school).order_by('-calculated_at').first()
        if snapshot is None:
            snapshot = calculate_school_health_score(school_id=school.id, actor_id=actor.id if actor else None)
        seven_day_low_scores = SchoolHealthSnapshot.objects.filter(
            school=school,
            calculated_at__gte=timezone.now() - timedelta(days=7),
            health_score__lt=50,
        ).count()
        last_login = _get_school_users(school).aggregate(last_login=Max('last_login'))['last_login']
        days_since_last_login = (timezone.now() - last_login).days if last_login else None
        billing_details = (school.details or {}).get('billing', {})
        payment_failure = normalize_role(billing_details.get('payment_status')) in {'past_due', 'late', 'overdue', 'failed'}
        contract_end_date = billing_details.get('renewal_date')
        contract_days_left = None
        if contract_end_date:
            try:
                contract_dt = datetime.fromisoformat(contract_end_date)
                if timezone.is_naive(contract_dt):
                    contract_dt = timezone.make_aware(contract_dt, timezone.get_current_timezone())
                contract_days_left = (contract_dt - timezone.now()).days
            except ValueError:
                contract_days_left = None

        risk_flags = []
        if seven_day_low_scores >= 1:
            risk_flags.append('health_score_below_50')
        if days_since_last_login is not None and days_since_last_login >= 30:
            risk_flags.append('no_logins_30_days')
        if payment_failure:
            risk_flags.append('payment_failure')
        if contract_days_left is not None and contract_days_left <= 30:
            risk_flags.append('renewal_approaching')

        if not risk_flags:
            continue

        retention_task = SchoolTask.objects.filter(
            school=school,
            title='Contact school regarding low engagement',
        ).exclude(status=TaskStatus.COMPLETE).first()
        if not retention_task:
            retention_task = create_school_task(
                school=school,
                created_by=actor,
                title='Contact school regarding low engagement',
                description='Review school health score and contact the school about low engagement.',
                assigned_to=school.assigned_staff,
                due_at=timezone.now() + timedelta(days=2),
                onboarding_progress=OnboardingProgress.objects.filter(school=school).first(),
                is_required=False,
                metadata={'retention_task': True, 'risk_flags': risk_flags},
            )

        log_activity(
            school=school,
            actor=actor,
            action='school_marked_at_risk',
            description=f'{school.name} flagged as at-risk.',
            metadata={'risk_flags': risk_flags, 'snapshot_id': snapshot.id, 'retention_task_id': retention_task.id},
            task=retention_task,
        )
        at_risk_results.append(
            {
                'school_id': school.id,
                'school_name': school.name,
                'health_score': snapshot.health_score,
                'risk_flags': risk_flags,
                'retention_task_id': retention_task.id,
            }
        )
    return at_risk_results


@transaction.atomic
def detect_upsell_opportunities(*, school_id, actor_id=None):
    try:
        school = School.objects.select_for_update().get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    actor = _get_active_user(actor_id) if actor_id else None
    latest_snapshot = SchoolHealthSnapshot.objects.filter(school=school).order_by('-calculated_at').first()
    if latest_snapshot is None:
        latest_snapshot = calculate_school_health_score(school_id=school.id, actor_id=actor.id if actor else None)

    plan_details = (school.details or {}).get('plan', {})
    billing_details = (school.details or {}).get('billing', {})
    open_opportunity_keys = set(
        UpsellOpportunity.objects.filter(school=school).exclude(status__in=[OpportunityStatus.WON, OpportunityStatus.LOST]).values_list('trigger_type', flat=True)
    )
    opportunities = []

    student_limit = plan_details.get('student_limit')
    teacher_limit = plan_details.get('teacher_limit')
    storage_limit_mb = plan_details.get('storage_limit_mb')
    current_storage_mb = plan_details.get('current_storage_mb', 0)
    student_count = Student._base_manager.filter(school=school, is_active=True).count()
    teacher_count = Teacher.objects.filter(school=school, is_active=True).count()

    def maybe_create(trigger_type, recommended_action, estimated_value, priority, details):
        if trigger_type in open_opportunity_keys:
            return None
        opportunity = UpsellOpportunity(
            school=school,
            trigger_type=trigger_type,
            recommended_action=recommended_action,
            estimated_value=Decimal(str(estimated_value)),
            priority=priority,
            details=details,
        )
        _save_with_validation(opportunity)
        open_opportunity_keys.add(trigger_type)
        log_activity(
            school=school,
            actor=actor,
            action='upsell_opportunity_detected',
            description=f'Upsell opportunity detected: {trigger_type}.',
            metadata={'opportunity_id': opportunity.id, 'trigger_type': trigger_type},
        )
        if school.assigned_staff:
            send_notification(
                school=school,
                recipient=school.assigned_staff,
                template_key='upsell_opportunity_detected',
                opportunity=opportunity,
                variables={'schoolName': school.name, 'triggerType': trigger_type},
                metadata={'auto_generated': True, 'opportunity_id': opportunity.id},
            )
        opportunities.append(opportunity)
        return opportunity

    if student_limit and student_limit > 0 and (student_count / student_limit) >= 0.9:
        maybe_create(
            'student_limit_90_percent',
            'Recommend upgrading the student capacity plan.',
            15000,
            1,
            {'student_count': student_count, 'student_limit': student_limit},
        )
    if teacher_limit and teacher_limit > 0 and (teacher_count / teacher_limit) >= 0.9:
        maybe_create(
            'teacher_limit_90_percent',
            'Recommend increasing the teacher capacity allowance.',
            10000,
            2,
            {'teacher_count': teacher_count, 'teacher_limit': teacher_limit},
        )
    if storage_limit_mb and storage_limit_mb > 0 and (current_storage_mb / storage_limit_mb) >= 0.85:
        maybe_create(
            'storage_high_usage',
            'Recommend moving to a higher storage tier.',
            8000,
            3,
            {'current_storage_mb': current_storage_mb, 'storage_limit_mb': storage_limit_mb},
        )
    if latest_snapshot.health_score >= 90:
        maybe_create(
            'high_health_score',
            'Position advanced modules as a quick win for a healthy school.',
            12000,
            2,
            {'health_score': latest_snapshot.health_score},
        )
    if Score.objects.filter(student__school=school).count() == 0 and Attendance._base_manager.filter(school=school).exists():
        maybe_create(
            'grading_not_adopted',
            'Recommend the grading module based on attendance adoption.',
            9000,
            4,
            {'attendance_in_use': True, 'grading_in_use': False},
        )

    renewal_date = billing_details.get('renewal_date')
    if renewal_date:
        try:
            renewal_dt = datetime.fromisoformat(renewal_date)
            if timezone.is_naive(renewal_dt):
                renewal_dt = timezone.make_aware(renewal_dt, timezone.get_current_timezone())
            if 0 <= (renewal_dt - timezone.now()).days <= 60:
                maybe_create(
                    'renewal_60_day_window',
                    'Start renewal and upgrade discussion before the renewal date.',
                    20000,
                    1,
                    {'renewal_date': renewal_date},
                )
        except ValueError:
            pass

    return [
        {
            'id': opportunity.id,
            'trigger_type': opportunity.trigger_type,
            'recommended_action': opportunity.recommended_action,
            'estimated_value': opportunity.estimated_value,
            'priority': opportunity.priority,
            'status': opportunity.status,
            'details': opportunity.details,
        }
        for opportunity in opportunities
    ]


def get_staff_workload(*, staff_id):
    staff = _get_active_user(staff_id)
    normalized_role = normalize_role(getattr(staff, 'role', ''))
    lead_queryset = Lead.objects.filter(assigned_to=staff, school_id__isnull=False)
    active_leads = lead_queryset.exclude(stage__in=[LeadStage.WON, LeadStage.LOST])
    active_onboardings = OnboardingProgress.objects.filter(
        assigned_to=staff,
        school__status=SchoolStatus.ONBOARDING,
        school_id__isnull=False,
    )
    active_schools = School.objects.filter(
        assigned_staff=staff,
        status=SchoolStatus.ACTIVE,
    )
    portfolio_schools = School.objects.filter(
        assigned_staff=staff,
    ).exclude(status=SchoolStatus.CHURNED)
    capacity_limit = _get_user_capacity_limit(staff)
    assignment_type = _get_assignment_type_for_role(normalized_role)
    current_load = {
        'lead': active_leads.count(),
        'onboarding': active_onboardings.count(),
        'school': active_schools.count(),
    }.get(assignment_type, portfolio_schools.count())

    return {
        'staff_id': staff.id,
        'staff_name': staff.full_name or staff.email,
        'role': normalized_role,
        'assignment_type': assignment_type,
        'lead_counts': {stage: lead_queryset.filter(stage=stage).count() for stage in LeadStage.values},
        'active_lead_count': active_leads.count(),
        'active_onboarding_count': active_onboardings.count(),
        'active_school_count': active_schools.count(),
        'portfolio_school_count': portfolio_schools.count(),
        'capacity_limit': capacity_limit,
        'current_load': current_load,
        'capacity_used_percent': round((current_load / capacity_limit) * 100, 2) if capacity_limit else None,
        'recent_assignment_at': _get_recent_assignment_at(staff, assignment_type),
    }


def can_accept_assignment(*, staff_id, assignment_type=None):
    workload = get_staff_workload(staff_id=staff_id)
    assignment_type = assignment_type or workload['assignment_type']
    normalized_role = workload['role']
    allowed_assignment_by_role = {
        'sales_rep': 'lead',
        'onboarding_specialist': 'onboarding',
        'account_manager': 'school',
        'manager': 'oversight',
    }
    if normalized_role in allowed_assignment_by_role and allowed_assignment_by_role[normalized_role] != assignment_type and normalized_role != 'manager':
        return {
            'can_accept': False,
            'reason': f'{normalized_role} cannot take {assignment_type} assignments.',
            'workload': workload,
        }

    capacity_limit = workload['capacity_limit']
    if capacity_limit is None:
        return {
            'can_accept': True,
            'reason': 'No capacity limit applies to this staff member.',
            'workload': workload,
        }

    if workload['current_load'] >= capacity_limit:
        return {
            'can_accept': False,
            'reason': f'{workload["staff_name"]} is at capacity for {assignment_type} assignments.',
            'workload': workload,
        }

    return {
        'can_accept': True,
        'reason': 'Staff member can accept the assignment.',
        'workload': workload,
    }


def find_available_staff(*, role, assignment_type=None):
    normalized_role = normalize_role(role)
    assignment_type = assignment_type or _get_assignment_type_for_role(normalized_role)
    candidates = User.objects.filter(is_active=True, school__isnull=True)
    candidates = [candidate for candidate in candidates if normalize_role(getattr(candidate, 'role', '')) == normalized_role]

    ranked_candidates = []
    for candidate in candidates:
        assessment = can_accept_assignment(staff_id=candidate.id, assignment_type=assignment_type)
        if not assessment['can_accept']:
            continue
        ranked_candidates.append(
            {
                'staff': candidate,
                'workload': assessment['workload'],
                'recent_assignment_at': assessment['workload']['recent_assignment_at'],
            }
        )

    ranked_candidates.sort(
        key=lambda item: (
            item['workload']['current_load'],
            item['recent_assignment_at'] or timezone.datetime(1970, 1, 1, tzinfo=timezone.get_current_timezone()),
            item['staff'].id,
        )
    )

    if ranked_candidates:
        best_match = ranked_candidates[0]
        return {
            'staff_id': best_match['staff'].id,
            'staff_name': best_match['staff'].full_name or best_match['staff'].email,
            'role': normalize_role(best_match['staff'].role),
            'fallback_used': False,
            'workload': best_match['workload'],
        }

    if normalized_role == 'sales_rep':
        managers = User.objects.filter(is_active=True, school__isnull=True)
        managers = [manager for manager in managers if normalize_role(getattr(manager, 'role', '')) == 'manager']
        if managers:
            manager = managers[0]
            return {
                'staff_id': manager.id,
                'staff_name': manager.full_name or manager.email,
                'role': normalize_role(manager.role),
                'fallback_used': True,
                'workload': get_staff_workload(staff_id=manager.id),
            }

    raise ValidationError({'role': f'No available staff found for role {normalized_role}.'})


def get_staff_capacity_alerts(*, threshold_percent=80):
    alerts = []
    for staff in User.objects.filter(is_active=True, school__isnull=True):
        workload = get_staff_workload(staff_id=staff.id)
        if workload['capacity_limit'] and workload['capacity_used_percent'] and workload['capacity_used_percent'] >= threshold_percent:
            alerts.append(
                {
                    'staff_id': staff.id,
                    'staff_name': workload['staff_name'],
                    'role': workload['role'],
                    'capacity_used_percent': workload['capacity_used_percent'],
                    'current_load': workload['current_load'],
                    'capacity_limit': workload['capacity_limit'],
                }
            )
    return alerts


def _validate_transfer_reason(reason):
    if normalize_role(reason) not in TRANSFER_REASONS:
        allowed_reasons = ', '.join(sorted(TRANSFER_REASONS))
        raise ValidationError({'reason': f'Transfer reason must be one of: {allowed_reasons}.'})


def _validate_transfer_permissions(*, initiated_by, school):
    if getattr(initiated_by, 'is_superuser', False) or getattr(initiated_by, 'is_staff', False):
        return
    initiator_role = normalize_role(getattr(initiated_by, 'role', ''))
    if school.assigned_staff_id == initiated_by.id and initiator_role in TRANSFER_ALLOWED_ROLES:
        return
    if initiator_role == 'manager':
        return
    raise ValidationError({'initiated_by_id': 'Staff member does not have permission to transfer this school.'})


def _update_task_transfer(task, *, target_staff, initiated_by, reassign_open_tasks, transfer_reason, notes):
    if reassign_open_tasks:
        task.assigned_to = target_staff
        task.metadata = _deep_merge_dict(
            task.metadata,
            {
                'transfer': {
                    'transferred_at': timezone.now().isoformat(),
                    'transferred_by_id': initiated_by.id,
                    'target_staff_id': target_staff.id,
                    'reason': transfer_reason,
                    'notes': notes,
                }
            },
        )
        _save_with_validation(task)
        action = 'task_reassigned'
        description = f'Task "{task.title}" reassigned to {target_staff.full_name or target_staff.email}.'
    else:
        task.status = TaskStatus.COMPLETE
        task.completed_at = timezone.now()
        task.completed_by = initiated_by
        task.metadata = _deep_merge_dict(
            task.metadata,
            {
                'transfer': {
                    'closed_at': timezone.now().isoformat(),
                    'closed_by_id': initiated_by.id,
                    'reason': transfer_reason,
                    'notes': notes,
                }
            },
        )
        _save_with_validation(task)
        action = 'task_closed_for_transfer'
        description = f'Task "{task.title}" closed during school transfer.'

    log_activity(
        school=task.school,
        actor=initiated_by,
        action=action,
        description=description,
        metadata={'task_id': task.id, 'target_staff_id': target_staff.id, 'reassign_open_tasks': reassign_open_tasks},
        lead=task.lead,
        onboarding_progress=task.onboarding_progress,
        task=task,
    )


@transaction.atomic
def transfer_school_assignment(
    *,
    school_id,
    initiated_by_id,
    target_staff_id,
    reason,
    notes='',
    transfer_items=None,
    reassign_open_tasks=True,
    schedule_intro_call=False,
    intro_call_due_at=None,
):
    initiated_by = _get_active_user(initiated_by_id)
    target_staff = _get_active_user(target_staff_id)
    _validate_transfer_reason(reason)
    _ensure_staff_role(target_staff, {'manager', 'account_manager', 'onboarding_specialist', 'sales_rep'}, action_label='receive school transfers')

    try:
        school = School.objects.select_for_update().get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    _validate_transfer_permissions(initiated_by=initiated_by, school=school)

    transfer_items = [normalize_role(item) for item in (transfer_items or ['all_school_data', 'active_tasks'])]
    invalid_items = [item for item in transfer_items if item not in TRANSFER_ITEM_OPTIONS]
    if invalid_items:
        raise ValidationError({'transfer_items': f'Invalid transfer items: {", ".join(sorted(invalid_items))}.'})
    if school.assigned_staff_id == target_staff.id:
        raise ValidationError({'target_staff_id': 'School is already assigned to the selected staff member.'})

    required_assignment_type = 'onboarding' if school.status == SchoolStatus.ONBOARDING else 'school'
    capacity_check = can_accept_assignment(staff_id=target_staff.id, assignment_type=required_assignment_type)
    if not capacity_check['can_accept']:
        raise ValidationError({'target_staff_id': capacity_check['reason']})

    previous_staff_id = school.assigned_staff_id
    previous_staff_name = school.assigned_staff.full_name if school.assigned_staff else ''
    transfer_timestamp = timezone.now()

    school.assigned_staff = target_staff
    school.details = _deep_merge_dict(
        school.details,
        {
            'transfers': [
                *school.details.get('transfers', []),
                {
                    'transferred_at': transfer_timestamp.isoformat(),
                    'initiated_by_id': initiated_by.id,
                    'from_staff_id': previous_staff_id,
                    'to_staff_id': target_staff.id,
                    'reason': normalize_role(reason),
                    'notes': notes,
                    'transfer_items': transfer_items,
                    'reassign_open_tasks': reassign_open_tasks,
                },
            ]
        },
    )
    _save_with_validation(school)

    progress = OnboardingProgress.objects.select_for_update().filter(school=school).first()
    if progress and school.status == SchoolStatus.ONBOARDING:
        progress.assigned_to = target_staff
        _save_with_validation(progress)

    transferred_task_ids = []
    if 'active_tasks' in transfer_items:
        open_tasks = SchoolTask.objects.select_for_update().filter(school=school).exclude(status=TaskStatus.COMPLETE)
        for task in open_tasks:
            _update_task_transfer(
                task,
                target_staff=target_staff,
                initiated_by=initiated_by,
                reassign_open_tasks=reassign_open_tasks,
                transfer_reason=normalize_role(reason),
                notes=notes,
            )
            transferred_task_ids.append(task.id)

    intro_call_task = None
    if schedule_intro_call:
        intro_call_task = create_school_task(
            school=school,
            created_by=initiated_by,
            title='Schedule school introduction call',
            description='Arrange a handoff introduction between outgoing and incoming staff with the school team.',
            assigned_to=target_staff,
            due_at=intro_call_due_at or (timezone.now() + timedelta(days=2)),
            step=progress.current_step if progress else '',
            onboarding_progress=progress,
            is_required=False,
            metadata={'transfer_follow_up': True},
        )

    log_activity(
        school=school,
        actor=initiated_by,
        action='school_transferred',
        description=f'School transferred from {previous_staff_name or "Unassigned"} to {target_staff.full_name or target_staff.email}.',
        metadata={
            'from_staff_id': previous_staff_id,
            'to_staff_id': target_staff.id,
            'reason': normalize_role(reason),
            'notes': notes,
            'transfer_items': transfer_items,
            'transferred_task_ids': transferred_task_ids,
            'intro_call_task_id': intro_call_task.id if intro_call_task else None,
        },
        onboarding_progress=progress,
    )
    send_notification(
        school=school,
        recipient=target_staff,
        template_key='school_transferred',
        onboarding_progress=progress,
        variables={'schoolName': school.name},
        metadata={'auto_generated': True, 'initiated_by_id': initiated_by.id},
    )

    return {
        'school': school,
        'onboarding_progress': progress,
        'transferred_task_ids': transferred_task_ids,
        'intro_call_task_id': intro_call_task.id if intro_call_task else None,
        'capacity_check': capacity_check['workload'],
    }


@transaction.atomic
def change_staff_role(
    *,
    staff_id,
    initiated_by_id,
    new_role,
    strategy,
    keep_lead_ids=None,
    keep_school_ids=None,
    target_staff_ids=None,
    notes='',
):
    initiated_by = _get_active_user(initiated_by_id)
    _ensure_manager_role(initiated_by, action_label='change staff roles')
    staff = _get_active_user(staff_id)
    new_role = normalize_role(new_role)
    strategy = _validate_role_change_strategy(strategy)
    keep_lead_ids = set(keep_lead_ids or [])
    keep_school_ids = set(keep_school_ids or [])
    target_staff_ids = target_staff_ids or {}

    impact = get_role_change_impact(staff_id=staff.id, new_role=new_role)
    mismatched_leads = list(
        Lead.objects.select_for_update().select_related('school').filter(
            id__in=[item['lead_id'] for item in impact['mismatched_assignments']['active_leads']]
        )
    )
    mismatched_onboarding_schools = list(
        School.objects.select_for_update().filter(
            id__in=[item['school_id'] for item in impact['mismatched_assignments']['onboarding_schools']]
        )
    )
    mismatched_active_schools = list(
        School.objects.select_for_update().filter(
            id__in=[item['school_id'] for item in impact['mismatched_assignments']['active_schools']]
        )
    )

    kept_assignments = {'lead_ids': [], 'school_ids': []}
    reassigned_assignments = {'lead_ids': [], 'school_ids': []}
    pending_completion = {'lead_ids': [], 'school_ids': []}

    if strategy == 'keep_with_manager_approval':
        invalid_lead_ids = keep_lead_ids.difference({lead.id for lead in mismatched_leads})
        invalid_school_ids = keep_school_ids.difference(
            {school.id for school in mismatched_onboarding_schools + mismatched_active_schools}
        )
        if invalid_lead_ids:
            raise ValidationError({'keep_lead_ids': 'Keep lead ids must come from mismatched assignments.'})
        if invalid_school_ids:
            raise ValidationError({'keep_school_ids': 'Keep school ids must come from mismatched assignments.'})

    for lead in mismatched_leads:
        if strategy == 'complete_current_work' or (strategy == 'keep_with_manager_approval' and lead.id in keep_lead_ids):
            if strategy == 'keep_with_manager_approval':
                kept_assignments['lead_ids'].append(lead.id)
                _log_role_change_keep(
                    school=lead.school,
                    initiated_by=initiated_by,
                    staff=staff,
                    new_role=new_role,
                    strategy=strategy,
                )
            else:
                pending_completion['lead_ids'].append(lead.id)
                log_activity(
                    school=lead.school,
                    actor=initiated_by,
                    action='role_change_pending_completion',
                    description=f'Lead kept with {staff.full_name or staff.email} until current work is completed.',
                    metadata={'lead_id': lead.id, 'staff_id': staff.id, 'new_role': new_role},
                    lead=lead,
                )
            continue

        target_staff = _resolve_reassignment_target(
            assignment_group='active_leads',
            target_staff_ids=target_staff_ids,
        )
        _reassign_lead(lead=lead, target_staff=target_staff, initiated_by=initiated_by, notes=notes)
        reassigned_assignments['lead_ids'].append(lead.id)

    for school in mismatched_onboarding_schools + mismatched_active_schools:
        if strategy == 'complete_current_work' or (strategy == 'keep_with_manager_approval' and school.id in keep_school_ids):
            if strategy == 'keep_with_manager_approval':
                kept_assignments['school_ids'].append(school.id)
                _log_role_change_keep(
                    school=school,
                    initiated_by=initiated_by,
                    staff=staff,
                    new_role=new_role,
                    strategy=strategy,
                )
            else:
                pending_completion['school_ids'].append(school.id)
                log_activity(
                    school=school,
                    actor=initiated_by,
                    action='role_change_pending_completion',
                    description=f'School kept with {staff.full_name or staff.email} until current work is completed.',
                    metadata={'school_id': school.id, 'staff_id': staff.id, 'new_role': new_role},
                )
            continue

        assignment_group = 'onboarding_schools' if school.status == SchoolStatus.ONBOARDING else 'active_schools'
        target_staff = _resolve_reassignment_target(
            assignment_group=assignment_group,
            target_staff_ids=target_staff_ids,
        )
        transfer_school_assignment(
            school_id=school.id,
            initiated_by_id=initiated_by.id,
            target_staff_id=target_staff.id,
            reason='role_change',
            notes=notes or f'Automatic reassignment for role change to {new_role}.',
            transfer_items=['all_school_data', 'active_tasks'],
            reassign_open_tasks=True,
            schedule_intro_call=False,
        )
        reassigned_assignments['school_ids'].append(school.id)

    previous_role = normalize_role(staff.role)
    staff.role = new_role
    _save_with_validation(staff, update_fields=['role', 'updated_at'])

    affected_school_ids = {
        *[lead.school_id for lead in mismatched_leads],
        *[school.id for school in mismatched_onboarding_schools],
        *[school.id for school in mismatched_active_schools],
    }
    for school in School.objects.filter(id__in=affected_school_ids):
        log_activity(
            school=school,
            actor=initiated_by,
            action='staff_role_changed',
            description=f'{staff.full_name or staff.email} role changed from {previous_role} to {new_role}.',
            metadata={
                'staff_id': staff.id,
                'previous_role': previous_role,
                'new_role': new_role,
                'strategy': strategy,
                'notes': notes,
            },
        )

    notification_school = School.objects.filter(id__in=affected_school_ids).order_by('id').first() or School.objects.order_by('id').first()
    if notification_school:
        send_notification(
            school=notification_school,
            recipient=staff,
            template_key='staff_role_changed',
            variables={'previousRole': previous_role, 'newRole': new_role},
            metadata={'auto_generated': True, 'initiated_by_id': initiated_by.id},
        )

    return {
        'staff_id': staff.id,
        'previous_role': previous_role,
        'new_role': new_role,
        'strategy': strategy,
        'kept_assignments': kept_assignments,
        'reassigned_assignments': reassigned_assignments,
        'pending_completion': pending_completion,
        'impact': impact,
    }


@transaction.atomic
def create_lead(*, staff_id, school_name, school_email='', school_phone='', school_address='', source='', priority=LeadPriority.MEDIUM, notes='', assigned_to_id=None):
    actor = _get_active_user(staff_id)
    assigned_to = _get_active_user(assigned_to_id) if assigned_to_id else actor
    school = School(
        name=school_name,
        email=school_email,
        phone=school_phone,
        address=school_address,
        status=SchoolStatus.LEAD,
        assigned_staff=assigned_to,
        details={'lead': {'source': source, 'created_by_id': actor.id}},
    )
    _save_with_validation(school)
    lead = Lead(
        school=school,
        source=source,
        priority=priority,
        notes=notes,
        assigned_to=assigned_to,
        created_by=actor,
        updated_by=actor,
        last_assigned_at=timezone.now(),
    )
    _save_with_validation(lead)
    log_activity(
        school=school,
        actor=actor,
        action='lead_created',
        description=f'Lead created for {school.name}.',
        metadata={'priority': priority, 'source': source, 'assigned_to_id': assigned_to.id if assigned_to else None},
        lead=lead,
    )
    if assigned_to:
        send_notification(
            school=school,
            recipient=assigned_to,
            template_key='new_lead_assigned',
            lead=lead,
            variables={
                'schoolName': school.name,
                'staffName': assigned_to.full_name or assigned_to.email,
            },
            metadata={'auto_generated': True},
        )
    return lead


@transaction.atomic
def create_school_task(*, school, created_by, title, description='', assigned_to=None, due_at=None, step='', onboarding_progress=None, lead=None, is_required=True, metadata=None):
    logger.info(
        "Step 3: Creating school task | school_id=%s title=%s step=%s assigned_to=%s",
        getattr(school, 'id', None),
        title,
        step,
        getattr(assigned_to, 'id', None),
    )
    _validate_school_scope(school=school, onboarding_progress=onboarding_progress, lead=lead)
    task = SchoolTask(
        school=school,
        onboarding_progress=onboarding_progress,
        lead=lead,
        step=step,
        title=title,
        description=description,
        assigned_to=assigned_to,
        created_by=created_by,
        due_at=due_at,
        is_required=is_required,
        metadata=metadata or {},
    )
    _save_with_validation(task)
    log_activity(
        school=school,
        actor=created_by,
        action='task_created',
        description=f'Task "{title}" created.',
        metadata={'step': step, 'assigned_to_id': assigned_to.id if assigned_to else None},
        lead=lead,
        onboarding_progress=onboarding_progress,
        task=task,
    )
    if assigned_to:
        send_notification(
            school=school,
            recipient=assigned_to,
            template_key='task_assigned',
            lead=lead,
            onboarding_progress=onboarding_progress,
            task=task,
            variables={
                'taskName': task.title,
                'schoolName': school.name,
            },
            metadata={'auto_generated': True},
        )
    if onboarding_progress:
        _sync_progress_completion(onboarding_progress)
    return task


@transaction.atomic
def start_onboarding_for_school(*, school, staff):
    logger.info(
        "Step 2: Starting onboarding progress | school_id=%s staff_id=%s",
        getattr(school, 'id', None),
        getattr(staff, 'id', None),
    )
    progress, created = OnboardingProgress.objects.select_for_update().get_or_create(
        school=school,
        defaults={
            'assigned_to': staff,
            'current_step': OnboardingStep.BASIC_INFO,
            'completed_steps': {},
            'step_payloads': {},
            'blockers': [],
        },
    )
    if progress.assigned_to_id != staff.id:
        progress.assigned_to = staff
        _save_with_validation(progress)

    blueprints = INITIAL_CONVERSION_TASK_BLUEPRINTS + DEFAULT_ONBOARDING_TASK_BLUEPRINTS
    existing_keys = set(
        SchoolTask.objects.filter(school=school, onboarding_progress=progress).values_list('title', 'step')
    )
    now = timezone.now()
    created_tasks = []
    for blueprint in blueprints:
        task_key = (blueprint['title'], blueprint['step'])
        if task_key in existing_keys:
            continue
        task = create_school_task(
            school=school,
            created_by=staff,
            title=blueprint['title'],
            description=blueprint['description'],
            assigned_to=staff,
            due_at=now + timedelta(days=blueprint['due_in_days']),
            step=blueprint['step'],
            onboarding_progress=progress,
            metadata={'default_task': True},
        )
        created_tasks.append(task)
        existing_keys.add(task_key)

    logger.info(
        "Step 4: Onboarding progress synchronized | school_id=%s progress_id=%s created=%s task_count=%s",
        school.id,
        progress.id,
        created,
        len(created_tasks),
    )

    log_activity(
        school=school,
        actor=staff,
        action='onboarding_initialized',
        description=f'Onboarding initialized for {school.name}.',
        metadata={'task_count': len(created_tasks), 'created': created},
        onboarding_progress=progress,
    )
    return progress


@transaction.atomic
def initialize_school_onboarding(*, school_id, staff_id, source='direct_onboarding', priority=LeadPriority.MEDIUM):
    logger.info(
        "Step 1: Creating school record context for onboarding | school_id=%s staff_id=%s source=%s priority=%s",
        school_id,
        staff_id,
        source,
        priority,
    )
    staff = _get_active_user(staff_id)
    try:
        school = School.objects.select_for_update().get(pk=school_id)
    except School.DoesNotExist as exc:
        raise ValidationError({'school_id': 'School was not found.'}) from exc

    lead = Lead.objects.select_for_update().filter(school=school).first()
    lead_created = False

    if not lead:
        lead = Lead.objects.create(
            school=school,
            stage=LeadStage.WON,
            source=source,
            priority=priority,
            assigned_to=staff,
            created_by=staff,
            updated_by=staff,
            notes='Initialized from direct SaaS onboarding flow.',
            last_assigned_at=timezone.now(),
            converted_at=timezone.now(),
            conversion_metadata={
                'direct_onboarding': True,
                'initialized_by_id': staff.id,
            },
        )
        lead_created = True

    if not lead_created:
        lead.stage = LeadStage.WON
        lead.source = lead.source or source
        lead.priority = lead.priority or priority
        lead.assigned_to = staff
        lead.updated_by = staff
        lead.converted_at = lead.converted_at or timezone.now()
        lead.last_assigned_at = timezone.now()
        lead.conversion_metadata = _deep_merge_dict(
            lead.conversion_metadata or {},
            {
                'direct_onboarding': True,
                'initialized_by_id': staff.id,
            },
        )
        _save_with_validation(lead)

    logger.info(
        "Step 1.1: Lead prepared for onboarding | school_id=%s lead_id=%s lead_created=%s",
        school.id,
        lead.id,
        lead_created,
    )

    school.status = SchoolStatus.ONBOARDING
    school.assigned_staff = staff
    school.converted_at = school.converted_at or timezone.now()
    school.details = _deep_merge_dict(
        school.details,
        {
            'conversion': {
                'converted_at': school.converted_at.isoformat(),
                'converted_by_id': staff.id,
                'lead_id': lead.id,
                'source': source,
                'direct_onboarding': True,
            }
        },
    )
    _save_with_validation(school)

    logger.info(
        "Step 1.2: School state updated to onboarding | school_id=%s assigned_staff_id=%s",
        school.id,
        staff.id,
    )

    progress = start_onboarding_for_school(school=school, staff=staff)
    send_notification(
        school=school,
        recipient=staff,
        template_key='onboarding_started',
        lead=lead,
        onboarding_progress=progress,
        variables={'schoolName': school.name, 'currentStep': progress.current_step},
        metadata={'auto_generated': True, 'direct_onboarding': True},
    )
    log_activity(
        school=school,
        actor=staff,
        action='school_onboarding_initialized',
        description=f'Onboarding initialized for {school.name} from direct onboarding flow.',
        metadata={'lead_id': lead.id, 'onboarding_progress_id': progress.id, 'source': source},
        lead=lead,
        onboarding_progress=progress,
    )
    logger.info(
        "Step 5: School onboarding initialized successfully | school_id=%s lead_id=%s progress_id=%s",
        school.id,
        lead.id,
        progress.id,
    )
    return {
        'school': school,
        'lead': lead,
        'onboarding_progress': progress,
        'lead_created': lead_created,
    }


@transaction.atomic
def convert_lead_to_school(*, lead_id, staff_id):
    staff = _get_active_user(staff_id)
    try:
        lead = Lead.objects.select_for_update().select_related('school').get(pk=lead_id)
    except Lead.DoesNotExist as exc:
        raise ValidationError({'lead_id': 'Lead was not found.'}) from exc

    school = lead.school
    if lead.converted_at:
        raise ValidationError({'lead_id': 'Lead has already been converted.'})
    if lead.stage == LeadStage.LOST:
        raise ValidationError({'lead_id': 'Lost leads cannot be converted.'})

    conversion_time = timezone.now()
    school.status = SchoolStatus.ONBOARDING
    school.assigned_staff = staff
    school.converted_at = conversion_time
    school.details = _deep_merge_dict(
        school.details,
        {
            'conversion': {
                'converted_at': conversion_time.isoformat(),
                'converted_by_id': staff.id,
                'lead_id': lead.id,
                'previous_stage': lead.stage,
            }
        },
    )
    _save_with_validation(school)

    lead.stage = LeadStage.WON
    lead.assigned_to = staff
    lead.updated_by = staff
    lead.converted_at = conversion_time
    lead.conversion_metadata = _deep_merge_dict(
        lead.conversion_metadata,
        {
            'converted_at': conversion_time.isoformat(),
            'converted_by_id': staff.id,
            'school_status': school.status,
        },
    )
    _save_with_validation(lead)

    progress = start_onboarding_for_school(school=school, staff=staff)

    log_activity(
        school=school,
        actor=staff,
        action='lead_converted',
        description=f'Lead converted to onboarding for {school.name}.',
        metadata={'lead_id': lead.id, 'onboarding_progress_id': progress.id},
        lead=lead,
        onboarding_progress=progress,
    )
    send_notification(
        school=school,
        recipient=staff,
        template_key='lead_converted',
        lead=lead,
        onboarding_progress=progress,
        variables={'schoolName': school.name},
        metadata={'auto_generated': True},
    )
    send_notification(
        school=school,
        recipient=staff,
        template_key='onboarding_started',
        lead=lead,
        onboarding_progress=progress,
        variables={'schoolName': school.name, 'currentStep': progress.current_step},
        metadata={'auto_generated': True},
    )
    return school, progress


@transaction.atomic
def transition_lead_stage(*, lead_id, staff_id, new_stage, loss_reason=''):
    staff = _get_active_user(staff_id)
    try:
        lead = Lead.objects.select_for_update().select_related('school').get(pk=lead_id)
    except Lead.DoesNotExist as exc:
        raise ValidationError({'lead_id': 'Lead was not found.'}) from exc

    if new_stage not in LeadStage.values:
        raise ValidationError({'new_stage': 'Invalid lead stage.'})
    if new_stage == lead.stage:
        return {'lead': lead, 'school': lead.school, 'onboarding_progress': getattr(lead.school, 'onboarding_progress', None)}

    valid_next_steps = VALID_LEAD_STAGE_TRANSITIONS.get(lead.stage, set())
    if new_stage not in valid_next_steps:
        raise ValidationError({'new_stage': f'Cannot transition lead from {lead.stage} to {new_stage}.'})

    school = lead.school
    previous_stage = lead.stage
    lead.stage = new_stage
    lead.updated_by = staff

    if new_stage == LeadStage.LOST:
        if not loss_reason.strip():
            raise ValidationError({'loss_reason': 'Loss reason is required when moving a lead to LOST.'})
        lead.loss_reason = loss_reason.strip()
        lead.lost_at = timezone.now()
        school.status = SchoolStatus.CHURNED
        school.details = _deep_merge_dict(
            school.details,
            {'churn': {'reason': lead.loss_reason, 'marked_at': lead.lost_at.isoformat(), 'marked_by_id': staff.id}},
        )
        _save_with_validation(school)
        _save_with_validation(lead)
        log_activity(
            school=school,
            actor=staff,
            action='lead_stage_changed',
            description=f'Lead stage changed from {previous_stage} to {new_stage}.',
            metadata={'from_stage': previous_stage, 'to_stage': new_stage, 'loss_reason': lead.loss_reason},
            lead=lead,
        )
        if lead.assigned_to:
            create_follow_up(
                school=school,
                created_by=staff,
                assigned_to=lead.assigned_to,
                lead=lead,
                title=f'Re-engage lost lead for {school.name}',
                description='Reconnect with the school after the loss period to explore renewed interest.',
                due_at=timezone.now() + timedelta(days=90),
                follow_up_type=FollowUpType.REENGAGEMENT,
                metadata={'trigger': 'lead_lost'},
            )
            send_notification(
                school=school,
                recipient=lead.assigned_to,
                template_key='lead_stage_changed',
                lead=lead,
                variables={'schoolName': school.name, 'stageName': new_stage},
                metadata={'auto_generated': True},
            )
        return {'lead': lead, 'school': school, 'onboarding_progress': getattr(school, 'onboarding_progress', None)}

    if new_stage == LeadStage.DEMO_SCHEDULED:
        create_school_task(
            school=school,
            created_by=staff,
            title='Schedule and prepare demo calendar task',
            description='Confirm demo attendees, agenda, and calendar logistics.',
            assigned_to=lead.assigned_to or staff,
            due_at=timezone.now() + timedelta(days=1),
            lead=lead,
            metadata={'calendar_task': True, 'trigger_stage': new_stage},
        )
        if lead.assigned_to:
            create_follow_up(
                school=school,
                created_by=staff,
                assigned_to=lead.assigned_to,
                lead=lead,
                title=f'Follow up after demo for {school.name}',
                description='Check in with the school two days after the demo.',
                due_at=timezone.now() + timedelta(days=2),
                follow_up_type=FollowUpType.QUICK_CALL,
                metadata={'trigger': 'demo_scheduled'},
            )
            send_notification(
                school=school,
                recipient=lead.assigned_to,
                template_key='demo_scheduled',
                lead=lead,
                variables={'schoolName': school.name},
                metadata={'auto_generated': True},
            )

    if new_stage == LeadStage.CONTRACT_SENT and lead.assigned_to:
        create_follow_up(
            school=school,
            created_by=staff,
            assigned_to=lead.assigned_to,
            lead=lead,
            title=f'Proposal follow-up for {school.name}',
            description='Follow up if there is no response to the proposal.',
            due_at=timezone.now() + timedelta(days=5),
            follow_up_type=FollowUpType.CUSTOM,
            metadata={'trigger': 'contract_sent'},
        )

    if new_stage == LeadStage.WON:
        _save_with_validation(lead)
        school, progress = convert_lead_to_school(lead_id=lead.id, staff_id=staff.id)
        log_activity(
            school=school,
            actor=staff,
            action='lead_stage_changed',
            description=f'Lead stage changed from {previous_stage} to {new_stage}.',
            metadata={'from_stage': previous_stage, 'to_stage': new_stage},
            lead=lead,
            onboarding_progress=progress,
        )
        return {'lead': lead, 'school': school, 'onboarding_progress': progress}

    school.status = SchoolStatus.LEAD
    _save_with_validation(school)
    _save_with_validation(lead)
    log_activity(
        school=school,
        actor=staff,
        action='lead_stage_changed',
        description=f'Lead stage changed from {previous_stage} to {new_stage}.',
        metadata={'from_stage': previous_stage, 'to_stage': new_stage},
        lead=lead,
    )
    if lead.assigned_to:
        send_notification(
            school=school,
            recipient=lead.assigned_to,
            template_key='lead_stage_changed',
            lead=lead,
            variables={'schoolName': school.name, 'stageName': new_stage},
            metadata={'auto_generated': True},
        )
    return {'lead': lead, 'school': school, 'onboarding_progress': getattr(school, 'onboarding_progress', None)}


@transaction.atomic
def process_onboarding_step(*, school_id, staff_id, step, step_data=None):
    staff = _get_active_user(staff_id)
    try:
        progress = OnboardingProgress.objects.select_for_update().select_related('school').get(school_id=school_id)
    except OnboardingProgress.DoesNotExist as exc:
        raise ValidationError({'school_id': 'Onboarding progress was not found for this school.'}) from exc

    school = progress.school
    _get_step_index(step)
    current_step_index = _get_step_index(step)
    completed_steps = progress.completed_steps or {}

    for required_step in ONBOARDING_STEP_SEQUENCE[:current_step_index]:
        if required_step not in completed_steps:
            raise ValidationError({'step': f'Cannot complete {step} before {required_step}.'})

    payload = step_data or {}
    completion_time = timezone.now()
    progress.step_payloads = _deep_merge_dict(progress.step_payloads, {step: payload})
    progress.completed_steps = _deep_merge_dict(
        completed_steps,
        {
            step: {
                'completed_at': completion_time.isoformat(),
                'completed_by_id': staff.id,
            }
        },
    )
    school.details = _deep_merge_dict(school.details, {'onboarding': {step: payload}})

    _save_with_validation(school)
    _sync_progress_completion(progress)

    if step == OnboardingStep.BASIC_INFO and not SchoolTask.objects.filter(
        school=school,
        onboarding_progress=progress,
        title='Review school setup checklist',
    ).exists():
        create_school_task(
            school=school,
            created_by=staff,
            title='Review school setup checklist',
            description='Validate that the onboarding setup checklist is complete before the next step.',
            assigned_to=progress.assigned_to or staff,
            due_at=timezone.now() + timedelta(days=1),
            step=OnboardingStep.PLAN_SELECTION,
            onboarding_progress=progress,
            is_required=False,
            metadata={'auto_created_for_step': step},
        )

    progress.refresh_from_db()
    log_activity(
        school=school,
        actor=staff,
        action='onboarding_step_completed',
        description=f'Onboarding step {step} completed for {school.name}.',
        metadata={'step': step, 'next_step': progress.current_step},
        onboarding_progress=progress,
    )
    if progress.assigned_to:
        send_notification(
            school=school,
            recipient=progress.assigned_to,
            template_key='onboarding_step_completed',
            onboarding_progress=progress,
            variables={'stepName': step, 'schoolName': school.name},
            metadata={'auto_generated': True},
        )
    if step == OnboardingStep.DATA_IMPORT:
        create_follow_up(
            school=school,
            created_by=staff,
            assigned_to=progress.assigned_to or staff,
            onboarding_progress=progress,
            title=f'Check data quality for {school.name}',
            description='Review imported records and validate data quality.',
            due_at=timezone.now() + timedelta(days=2),
            follow_up_type=FollowUpType.DATA_REVIEW,
            metadata={'trigger': 'data_import_completed'},
        )
    if step == OnboardingStep.TRAINING:
        create_follow_up(
            school=school,
            created_by=staff,
            assigned_to=progress.assigned_to or school.assigned_staff or staff,
            onboarding_progress=progress,
            title=f'First-week usage check for {school.name}',
            description='Check how the school is using the platform after training.',
            due_at=timezone.now() + timedelta(days=7),
            follow_up_type=FollowUpType.QUICK_CALL,
            metadata={'trigger': 'training_completed'},
        )
    return progress


@transaction.atomic
def update_school_task_status(*, school_id, task_id, staff_id, status, blocked_reason=''):
    staff = _get_active_user(staff_id)
    try:
        task = SchoolTask.objects.select_for_update().select_related('school', 'onboarding_progress').get(pk=task_id, school_id=school_id)
    except SchoolTask.DoesNotExist as exc:
        raise ValidationError({'task_id': 'Task was not found for this school.'}) from exc

    if status not in TaskStatus.values:
        raise ValidationError({'status': 'Invalid task status.'})
    if status == TaskStatus.BLOCKED and not blocked_reason.strip():
        raise ValidationError({'blocked_reason': 'Blocked tasks require a reason.'})

    task.status = status
    task.blocked_reason = blocked_reason.strip() if status == TaskStatus.BLOCKED else ''
    if status == TaskStatus.COMPLETE:
        task.completed_at = timezone.now()
        task.completed_by = staff
    else:
        task.completed_at = None
        task.completed_by = None
    _save_with_validation(task)

    if task.onboarding_progress:
        _sync_progress_completion(task.onboarding_progress)

    log_activity(
        school=task.school,
        actor=staff,
        action='task_status_changed',
        description=f'Task "{task.title}" updated to {status}.',
        metadata={'status': status, 'blocked_reason': task.blocked_reason},
        lead=task.lead,
        onboarding_progress=task.onboarding_progress,
        task=task,
    )
    task.refresh_from_db()
    return task


def get_onboarding_progress_snapshot(*, school_id):
    try:
        progress = OnboardingProgress.objects.select_related('school', 'assigned_to').get(school_id=school_id)
    except OnboardingProgress.DoesNotExist as exc:
        raise ValidationError({'school_id': 'Onboarding progress was not found for this school.'}) from exc

    tasks = SchoolTask.objects.filter(school_id=school_id, onboarding_progress=progress).select_related('assigned_to')
    current_tasks = tasks.filter(step=progress.current_step).order_by('due_at', 'created_at')
    blocked_tasks = tasks.filter(status=TaskStatus.BLOCKED).order_by('due_at', 'created_at')
    blockers = [
        {
            'task_id': task.id,
            'title': task.title,
            'reason': task.blocked_reason,
        }
        for task in blocked_tasks
    ]

    completed_steps = progress.completed_steps or {}
    completed_step_names = [step for step in ONBOARDING_STEP_SEQUENCE if step in completed_steps]
    percentage_complete = int((len(completed_step_names) / len(ONBOARDING_STEP_SEQUENCE)) * 100)

    return {
        'school_id': progress.school_id,
        'school_name': progress.school.name,
        'assigned_to_id': progress.assigned_to_id,
        'current_step': progress.current_step,
        'completed_steps': [
            {
                'step': step,
                'completed_at': completed_steps[step].get('completed_at'),
                'completed_by_id': completed_steps[step].get('completed_by_id'),
            }
            for step in completed_step_names
        ],
        'percentage_complete': percentage_complete,
        'pending_tasks': [
            {
                'id': task.id,
                'title': task.title,
                'status': task.status,
                'due_at': task.due_at,
                'assigned_to_id': task.assigned_to_id,
            }
            for task in current_tasks
        ],
        'blockers': blockers,
        'step_payloads': progress.step_payloads,
        'started_at': progress.started_at,
        'completed_at': progress.completed_at,
    }
