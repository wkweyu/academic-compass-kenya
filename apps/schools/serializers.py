from rest_framework import serializers

from .models import ActivityLog, Lead, OnboardingProgress, School, SchoolHealthSnapshot, SchoolTask, UpsellOpportunity


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = '__all__'
        read_only_fields = ['code', 'created_at', 'updated_at', 'converted_at']


class LeadSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(queryset=School.objects.all(), source='school', write_only=True, required=False)

    class Meta:
        model = Lead
        fields = [
            'id',
            'school',
            'school_id',
            'stage',
            'source',
            'priority',
            'assigned_to',
            'created_by',
            'updated_by',
            'notes',
            'loss_reason',
            'last_assigned_at',
            'lost_at',
            'converted_at',
            'conversion_metadata',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'created_by',
            'updated_by',
            'last_assigned_at',
            'lost_at',
            'converted_at',
            'conversion_metadata',
            'created_at',
            'updated_at',
        ]


class LeadCreateSerializer(serializers.Serializer):
    school_name = serializers.CharField(max_length=255)
    school_email = serializers.EmailField(required=False, allow_blank=True)
    school_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    school_address = serializers.CharField(required=False, allow_blank=True)
    source = serializers.CharField(required=False, allow_blank=True, max_length=100)
    priority = serializers.ChoiceField(choices=Lead._meta.get_field('priority').choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    assigned_to_id = serializers.IntegerField(required=False)


class LeadStageTransitionSerializer(serializers.Serializer):
    new_stage = serializers.ChoiceField(choices=Lead._meta.get_field('stage').choices)
    loss_reason = serializers.CharField(required=False, allow_blank=True)


class SchoolTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolTask
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'completed_at', 'completed_by', 'created_by']


class SchoolTaskCreateSerializer(serializers.Serializer):
    school_id = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    assigned_to_id = serializers.IntegerField(required=False)
    due_at = serializers.DateTimeField(required=False)
    step = serializers.CharField(required=False, allow_blank=True)
    onboarding_progress_id = serializers.IntegerField(required=False)
    lead_id = serializers.IntegerField(required=False)
    is_required = serializers.BooleanField(required=False, default=True)
    metadata = serializers.JSONField(required=False)


class SchoolTaskStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SchoolTask._meta.get_field('status').choices)
    blocked_reason = serializers.CharField(required=False, allow_blank=True)


class OnboardingProgressSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)

    class Meta:
        model = OnboardingProgress
        fields = '__all__'
        read_only_fields = ['started_at', 'updated_at', 'completed_at', 'handed_over_to_school_at']


class OnboardingStepProcessSerializer(serializers.Serializer):
    step = serializers.ChoiceField(choices=OnboardingProgress._meta.get_field('current_step').choices)
    step_data = serializers.JSONField(required=False)


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ['created_at']


class SchoolHealthSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolHealthSnapshot
        fields = '__all__'
        read_only_fields = ['calculated_at']


class UpsellOpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = UpsellOpportunity
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class AvailableStaffQuerySerializer(serializers.Serializer):
    role = serializers.CharField(max_length=50)
    assignment_type = serializers.CharField(max_length=50, required=False, allow_blank=True)


class SchoolTransferSerializer(serializers.Serializer):
    target_staff_id = serializers.IntegerField()
    reason = serializers.ChoiceField(
        choices=[
            ('workload_balancing', 'Workload balancing'),
            ('role_change', 'Role change'),
            ('staff_departure', 'Staff departure'),
            ('specialization', 'Specialization'),
        ]
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    transfer_items = serializers.ListField(
        child=serializers.ChoiceField(
            choices=[
                ('all_school_data', 'All school data'),
                ('active_tasks', 'Active tasks'),
                ('communication_history', 'Communication history'),
            ]
        ),
        required=False,
    )
    reassign_open_tasks = serializers.BooleanField(required=False, default=True)
    schedule_intro_call = serializers.BooleanField(required=False, default=False)
    intro_call_due_at = serializers.DateTimeField(required=False)
