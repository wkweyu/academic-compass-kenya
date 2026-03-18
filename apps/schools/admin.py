from django.contrib import admin
from .models import ActivityLog, Lead, OnboardingProgress, School, SchoolHealthSnapshot, SchoolTask, UpsellOpportunity

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
