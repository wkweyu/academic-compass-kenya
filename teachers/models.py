
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone

class Teacher(models.Model):
    """Model for teachers"""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
    ]
    
    # Personal Information
    full_name = models.CharField(max_length=200)
    tsc_number = models.CharField(
        max_length=20, 
        unique=True, 
        help_text="Teachers Service Commission Number"
    )
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    date_of_birth = models.DateField()
    
    # Contact Information
    phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^\+?254[0-9]{9}$|^0[0-9]{9}$',
            message="Enter a valid Kenyan phone number"
        )]
    )
    email = models.EmailField()
    
    # Employment Information
    date_joined = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'teachers'
        verbose_name = 'Teacher'
        verbose_name_plural = 'Teachers'
        ordering = ['full_name']
    
    def __str__(self):
        return f"{self.full_name} ({self.tsc_number})"
    
    @property
    def age(self):
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    @property
    def years_of_service(self):
        today = timezone.now().date()
        return today.year - self.date_joined.year

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
