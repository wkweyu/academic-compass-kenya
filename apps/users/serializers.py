from rest_framework import serializers
from apps.schools.serializers import SchoolSerializer
from .models import User


class UserSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    linked_entity_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'school',
            'entity_type',
            'entity_id',
            'status',
            'login_enabled',
            'force_password_change',
            'expires_at',
            'last_login',
            'linked_entity_name',
        ]

    def get_linked_entity_name(self, obj):
        if not obj.entity_type or not obj.entity_id:
            return None

        try:
            from .services import AccountService
            entity = AccountService._resolve_entity(obj.entity_type, obj.entity_id)
            if entity:
                if hasattr(entity, 'full_name') and entity.full_name:
                    return entity.full_name
                if hasattr(entity, 'name') and entity.name:
                    return entity.name
                first = getattr(entity, 'first_name', '')
                last = getattr(entity, 'last_name', '')
                if first or last:
                    return f"{first} {last}".strip()
        except Exception:
            return None
        return None


class UserRoleChangePreviewSerializer(serializers.Serializer):
    new_role = serializers.CharField(max_length=50)


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = [
            'id',
            'login_time',
            'logout_time',
            'ip_address',
            'user_agent',
            'successful',
            'failure_reason',
        ]


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


class EnableLoginSerializer(serializers.Serializer):
    entity_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    entity_id = serializers.IntegerField(required=False, allow_null=True)
    email = serializers.EmailField()
    role = serializers.CharField(max_length=50, required=False, allow_blank=True)
    send_invite = serializers.BooleanField(default=False)
    login_enabled = serializers.BooleanField(default=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
