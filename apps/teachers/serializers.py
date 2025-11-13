# teachers/serializers.py
from rest_framework import serializers
from .models import Teacher, TeacherSubjectAssignment

class TeacherSerializer(serializers.ModelSerializer):
    """
    Serializer for Teacher/Staff model
    Maps frontend Staff fields to backend Teacher model
    """
    # Computed fields
    full_name = serializers.SerializerMethodField()
    years_of_service = serializers.SerializerMethodField()
    gross_salary = serializers.SerializerMethodField()
    
    # Map frontend fields that don't exist in model yet
    employee_no = serializers.CharField(source='tsc_number', allow_blank=True, required=False)
    staff_category = serializers.CharField(default='Teaching Staff', allow_blank=True)
    department = serializers.CharField(default='Academic', allow_blank=True)
    job_title = serializers.CharField(default='Teacher', allow_blank=True)
    designation = serializers.CharField(default='Teacher', allow_blank=True)
    employment_type = serializers.CharField(default='Permanent', allow_blank=True)
    hire_date = serializers.DateField(source='date_joined', required=False)
    
    # Personal info
    first_name = serializers.CharField(default='', allow_blank=True)
    last_name = serializers.CharField(default='', allow_blank=True)
    address = serializers.CharField(default='', allow_blank=True)
    emergency_contact_name = serializers.CharField(default='', allow_blank=True)
    emergency_contact_phone = serializers.CharField(default='', allow_blank=True)
    
    # Banking fields (not in model, but accepted)
    bank_name = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    bank_branch = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    account_number = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    kra_pin = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    nhif_number = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    nssf_number = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    
    # Salary fields (not in model, but accepted)
    salary_scale = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    basic_salary = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, required=False, write_only=True)
    house_allowance = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, required=False, write_only=True)
    transport_allowance = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, required=False, write_only=True)
    responsibility_allowance = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, required=False, write_only=True)
    other_allowances = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, required=False, write_only=True)
    
    # Status
    status = serializers.CharField(default='Active', allow_blank=True)
    national_id = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    passport_no = serializers.CharField(default='', allow_blank=True, required=False, write_only=True)
    
    class Meta:
        model = Teacher
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'employee_no',
            'tsc_number', 'gender', 'date_of_birth', 'phone', 'email',
            'address', 'emergency_contact_name', 'emergency_contact_phone',
            'staff_category', 'department', 'job_title', 'designation',
            'employment_type', 'hire_date', 'national_id', 'passport_no',
            'bank_name', 'bank_branch', 'account_number', 'kra_pin',
            'nhif_number', 'nssf_number', 'salary_scale', 'basic_salary',
            'house_allowance', 'transport_allowance', 'responsibility_allowance',
            'other_allowances', 'gross_salary', 'status', 'is_active',
            'years_of_service', 'created_at', 'updated_at', 'school'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'school']
    
    def get_full_name(self, obj):
        first = getattr(obj, 'first_name', '')
        last = getattr(obj, 'last_name', '')
        if first or last:
            return f"{first} {last}".strip()
        return obj.full_name
    
    def get_years_of_service(self, obj):
        return obj.years_of_service if hasattr(obj, 'years_of_service') else 0
    
    def get_gross_salary(self, obj):
        return 0  # Placeholder since salary fields not in model yet
    
    def create(self, validated_data):
        # Build full_name from first and last name
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        full_name = f"{first_name} {last_name}".strip()
        
        # Remove fields that don't exist in the model
        validated_data.pop('address', None)
        validated_data.pop('emergency_contact_name', None)
        validated_data.pop('emergency_contact_phone', None)
        validated_data.pop('staff_category', None)
        validated_data.pop('department', None)
        validated_data.pop('job_title', None)
        validated_data.pop('designation', None)
        validated_data.pop('employment_type', None)
        validated_data.pop('status', None)
        validated_data.pop('national_id', None)
        validated_data.pop('passport_no', None)
        validated_data.pop('bank_name', None)
        validated_data.pop('bank_branch', None)
        validated_data.pop('account_number', None)
        validated_data.pop('kra_pin', None)
        validated_data.pop('nhif_number', None)
        validated_data.pop('nssf_number', None)
        validated_data.pop('salary_scale', None)
        validated_data.pop('basic_salary', None)
        validated_data.pop('house_allowance', None)
        validated_data.pop('transport_allowance', None)
        validated_data.pop('responsibility_allowance', None)
        validated_data.pop('other_allowances', None)
        
        # Create teacher with available fields
        teacher = Teacher.objects.create(
            full_name=full_name,
            **validated_data
        )
        return teacher

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
