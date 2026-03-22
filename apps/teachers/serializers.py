# teachers/serializers.py
from rest_framework import serializers
from .models import Teacher, TeacherSubjectAssignment
from apps.core.middleware import get_current_school

class TeacherSerializer(serializers.ModelSerializer):
    """
    Serializer for Teacher/Staff model - now fully supports all fields
    """
    # Computed fields
    full_name = serializers.CharField(read_only=True)
    years_of_service = serializers.SerializerMethodField()
    gross_salary = serializers.SerializerMethodField()
    
    class Meta:
        model = Teacher
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'employee_no',
            'tsc_number', 'gender', 'date_of_birth', 'phone', 'email',
            'address', 'emergency_contact_name', 'emergency_contact_phone',
            'staff_category', 'department', 'job_title', 'designation',
            'employment_type', 'hire_date', 'date_joined', 'national_id', 'passport_no',
            'bank_name', 'bank_branch', 'account_number', 'kra_pin',
            'nhif_number', 'nssf_number', 'salary_scale', 'basic_salary',
            'house_allowance', 'transport_allowance', 'responsibility_allowance',
            'other_allowances', 'gross_salary', 'status', 'is_active',
            'years_of_service', 'created_at', 'updated_at', 'school_id'
        ]
        read_only_fields = ['id', 'full_name', 'created_at', 'updated_at', 'school_id']
    
    def get_years_of_service(self, obj):
        """Calculate years of service from hire_date"""
        from datetime import date
        if obj.hire_date:
            today = date.today()
            years = today.year - obj.hire_date.year
            if (today.month, today.day) < (obj.hire_date.month, obj.hire_date.day):
                years -= 1
            return max(0, years)
        return 0
    
    def get_gross_salary(self, obj):
        """Calculate gross salary from basic + all allowances"""
        return float(
            obj.basic_salary + 
            obj.house_allowance + 
            obj.transport_allowance + 
            obj.responsibility_allowance + 
            obj.other_allowances
        )
    
    def update(self, instance, validated_data):
        """Update teacher - preserve school_id"""
        # Remove school from validated_data if present (shouldn't change)
        validated_data.pop('school', None)
        validated_data.pop('school_id', None)
        
        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class TeacherSubjectAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Teacher Subject Assignments"""
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    class_name = serializers.CharField(source='class_assigned.name', read_only=True)
    stream_name = serializers.CharField(source='stream.name', read_only=True, allow_null=True)
    
    class Meta:
        model = TeacherSubjectAssignment
        fields = [
            'id', 'teacher', 'teacher_name', 'subject', 'subject_name',
            'class_assigned', 'class_name', 'stream', 'stream_name',
            'academic_year', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
