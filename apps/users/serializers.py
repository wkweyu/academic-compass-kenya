from rest_framework import serializers
from apps.schools.serializers import SchoolSerializer
from .models import User  # Make sure you're importing your User model correctly

class UserSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role', 'school']


class UserRoleChangePreviewSerializer(serializers.Serializer):
    new_role = serializers.CharField(max_length=50)


class UserRoleChangeSerializer(serializers.Serializer):
    new_role = serializers.CharField(max_length=50)
    strategy = serializers.ChoiceField(
        choices=[
            ('auto_reassign', 'Auto reassign'),
            ('keep_with_manager_approval', 'Keep with manager approval'),
            ('complete_current_work', 'Complete current work'),
        ]
    )
    keep_lead_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    keep_school_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    lead_target_staff_id = serializers.IntegerField(required=False)
    onboarding_target_staff_id = serializers.IntegerField(required=False)
    school_target_staff_id = serializers.IntegerField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128, required=False, allow_blank=True)