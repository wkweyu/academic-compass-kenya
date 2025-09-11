from rest_framework import serializers
from datetime import date
from .models import Student
from apps.core.middleware import get_current_school


class StudentSerializer(serializers.ModelSerializer):
    admission_number = serializers.CharField(read_only=True)

    # Human-readable names for foreign keys
    current_class_name = serializers.CharField(source="current_class.name", read_only=True)
    current_stream_name = serializers.CharField(source="current_stream.name", read_only=True)

    # Serializer-only fields
    status = serializers.SerializerMethodField()
    enrollment_date = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Student
        fields = [
            'id',
            'admission_number',
            'full_name',
            'gender',
            'date_of_birth',
            'photo',
            'kcpe_index',
            'admission_year',
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
            'current_class',
            'current_stream',
            'current_class_name',
            'current_stream_name',
            'enrollment_date',   # mapped to created_at
            'status',            # computed from is_active
            'is_active',
        ]
        read_only_fields = [
            'id',
            'admission_number',
            'is_active',
            'enrollment_date',
            'status',
        ]

    # ----------------
    # VALIDATIONS
    # ----------------
    def validate_date_of_birth(self, value):
        if value > date.today():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value

    def validate_admission_year(self, value):
        current_year = date.today().year
        if value > current_year:
            raise serializers.ValidationError(f"Admission year cannot be in the future ({current_year}).")
        if value < 1980:
            raise serializers.ValidationError("Admission year seems too old.")
        return value

    def validate_guardian_phone(self, value):
        if not value.startswith(("07", "+254")):
            raise serializers.ValidationError("Phone must start with '07...' or '+254...'.")
        if len(value) < 10:
            raise serializers.ValidationError("Phone number seems too short.")
        return value

    def validate_full_name(self, value):
        if len(value.split()) < 2:
            raise serializers.ValidationError("Full name must include at least two names.")
        return value

    # ----------------
    # CREATE / UPDATE
    # ----------------
    def create(self, validated_data):
        school = get_current_school()
        if school:
            validated_data['school'] = school
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if not validated_data.get("photo"):
            validated_data.pop("photo", None)
        return super().update(instance, validated_data)

    # ----------------
    # CUSTOM FIELDS
    # ----------------
    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"
