
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone

class Teacher(models.Model):
    """Model for teachers/staff with comprehensive HR fields"""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
    ]
    
    STAFF_CATEGORY_CHOICES = [
        ('Teaching Staff', 'Teaching Staff'),
        ('Administrative Staff', 'Administrative Staff'),
        ('Support Staff', 'Support Staff'),
    ]
    
    EMPLOYMENT_TYPE_CHOICES = [
        ('Permanent', 'Permanent'),
        ('Contract', 'Contract'),
        ('Part-Time', 'Part-Time'),
        ('Temporary', 'Temporary'),
    ]
    
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('On Leave', 'On Leave'),
        ('Suspended', 'Suspended'),
        ('Terminated', 'Terminated'),
    ]
    
    # School relationship - must match Supabase column name
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='teachers',
        db_column='school_id',  # Maps to school_id in Supabase
        null=False,  # Required field
        blank=False
    )
    
    # Personal Information
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    full_name = models.CharField(max_length=200, blank=True)  # Auto-generated
    employee_no = models.CharField(max_length=50, blank=True, unique=True, null=True)
    tsc_number = models.CharField(
        max_length=20, 
        unique=True, 
        help_text="Teachers Service Commission Number"
    )
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    date_of_birth = models.DateField()
    national_id = models.CharField(max_length=50, blank=True)
    passport_no = models.CharField(max_length=50, blank=True)
    
    # Contact Information
    phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^\+?254[0-9]{9}$|^0[0-9]{9}$',
            message="Enter a valid Kenyan phone number"
        )]
    )
    email = models.EmailField()
    address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    
    # Employment Information
    staff_category = models.CharField(max_length=100, choices=STAFF_CATEGORY_CHOICES, blank=True)
    department = models.CharField(max_length=100, blank=True)
    job_title = models.CharField(max_length=100, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    employment_type = models.CharField(max_length=50, choices=EMPLOYMENT_TYPE_CHOICES, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    date_joined = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')
    is_active = models.BooleanField(default=True)
    
    # Banking Information
    bank_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    account_number = models.CharField(max_length=50, blank=True)
    
    # Tax & Insurance
    kra_pin = models.CharField(max_length=50, blank=True)
    nhif_number = models.CharField(max_length=50, blank=True)
    nssf_number = models.CharField(max_length=50, blank=True)
    
    # Salary Information
    salary_scale = models.CharField(max_length=50, blank=True)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    house_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    responsibility_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'teachers'
        verbose_name = 'Teacher'
        verbose_name_plural = 'Teachers'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        # Auto-generate full_name from first_name and last_name
        if self.first_name or self.last_name:
            self.full_name = f"{self.first_name} {self.last_name}".strip()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.full_name} ({self.tsc_number})" if self.full_name else self.tsc_number
    
    @property
    def age(self):
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    @property
    def years_of_service(self):
        today = timezone.now().date()
        service_date = self.hire_date or self.date_joined
        return today.year - service_date.year

class TeacherSubjectAssignment(models.Model):
    """Model to assign teachers to subjects and classes"""
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='subject_assignments')
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE)
    class_assigned = models.ForeignKey('students.Class', on_delete=models.CASCADE)
    stream = models.ForeignKey('students.Stream', on_delete=models.CASCADE, null=True, blank=True)
    academic_year = models.IntegerField(default=timezone.now().year)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'teacher_subject_assignments'
        verbose_name = 'Teacher Subject Assignment'
        verbose_name_plural = 'Teacher Subject Assignments'
        unique_together = ['teacher', 'subject', 'class_assigned', 'stream', 'academic_year']
        ordering = ['teacher', 'subject']
    
    def __str__(self):
        stream_info = f" {self.stream.name}" if self.stream else ""
        return f"{self.teacher.full_name} - {self.subject.name} ({self.class_assigned.name}{stream_info})"
