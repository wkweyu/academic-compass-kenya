from django.contrib import admin
from .models import (
    ActivityLog,
    CommunicationLog,
    FollowUp,
    Lead,
    NotificationRecord,
    NotificationTemplate,
    OnboardingProgress,
    School,
    SchoolHealthSnapshot,
    SchoolTask,
    UpsellOpportunity,
)

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'status', 'assigned_staff', 'phone', 'email', 'active', 'created_at')
    search_fields = ('name', 'code')
    readonly_fields = ('code', 'created_at', 'updated_at', 'converted_at')
    ordering = ('code',)


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('school', 'stage', 'priority', 'assigned_to', 'converted_at', 'created_at')
    list_filter = ('stage', 'priority')
    search_fields = ('school__name', 'school__code', 'source')
    readonly_fields = ('converted_at', 'created_at', 'updated_at', 'last_assigned_at', 'lost_at')


@admin.register(OnboardingProgress)
class OnboardingProgressAdmin(admin.ModelAdmin):
    list_display = ('school', 'assigned_to', 'current_step', 'started_at', 'completed_at')
    search_fields = ('school__name', 'school__code')
    readonly_fields = ('started_at', 'updated_at', 'completed_at', 'handed_over_to_school_at')


@admin.register(SchoolTask)
class SchoolTaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'school', 'step', 'status', 'assigned_to', 'due_at')
    list_filter = ('status', 'step', 'is_required')
    search_fields = ('title', 'school__name', 'school__code')
    readonly_fields = ('created_at', 'updated_at', 'completed_at')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'school', 'actor', 'created_at')
    list_filter = ('action',)
    search_fields = ('action', 'description', 'school__name', 'school__code')
    readonly_fields = ('created_at',)


@admin.register(SchoolHealthSnapshot)
class SchoolHealthSnapshotAdmin(admin.ModelAdmin):
    list_display = ('school', 'health_score', 'trend', 'calculated_at')
    list_filter = ('trend',)
    search_fields = ('school__name', 'school__code')
    readonly_fields = ('calculated_at',)


@admin.register(UpsellOpportunity)
class UpsellOpportunityAdmin(admin.ModelAdmin):
    list_display = ('school', 'trigger_type', 'priority', 'status', 'created_at')
    list_filter = ('status', 'priority')
    search_fields = ('school__name', 'school__code', 'trigger_type')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('key', 'name', 'schedule_type', 'is_active', 'updated_at')
    list_filter = ('schedule_type', 'is_active')
    search_fields = ('key', 'name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(NotificationRecord)
class NotificationRecordAdmin(admin.ModelAdmin):
    list_display = ('template_key', 'channel', 'recipient', 'school', 'status', 'scheduled_for', 'sent_at')
    list_filter = ('channel', 'status')
    search_fields = ('template_key', 'subject', 'recipient__email', 'school__name', 'school__code')
    readonly_fields = ('created_at', 'updated_at', 'sent_at', 'read_at', 'opened_at')


@admin.register(CommunicationLog)
class CommunicationLogAdmin(admin.ModelAdmin):
    list_display = ('communication_type', 'direction', 'school', 'created_by', 'occurred_at', 'follow_up_required')
    list_filter = ('communication_type', 'direction', 'follow_up_required')
    search_fields = ('subject', 'content', 'school__name', 'school__code')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ('title', 'school', 'assigned_to', 'follow_up_type', 'status', 'due_at')
    list_filter = ('follow_up_type', 'status', 'recurrence')
    search_fields = ('title', 'description', 'school__name', 'school__code')
    readonly_fields = ('created_at', 'updated_at', 'completed_at', 'escalated_at')
