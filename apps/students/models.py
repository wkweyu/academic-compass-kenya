
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
import os
from apps.schools.models import School
from apps.core.managers import SchoolManager
from apps.core.middleware import get_current_school
from apps.core.models import SchoolScopedModel
from apps.core.constants import SchoolLevels
from apps.transport.models import TransportRoute

def student_photo_path(instance, filename):
    """Generate upload path for student photos"""
    return f'students/photos/{instance.admission_number}_{filename}'

class Class(models.Model):
    """Model for school classes (Grade 1, Grade 2, etc.)"""
    name = models.CharField(max_length=50, unique=True)
    grade_level = models.IntegerField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes')
 
    class Meta:
        db_table = 'classes'
        verbose_name = 'Class'
        verbose_name_plural = 'Classes'
        ordering = ['grade_level', 'name']
    
    def __str__(self):
        return self.name

class Stream(models.Model):
    name = models.CharField(max_length=10)
    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='streams')
    year = models.IntegerField(default=timezone.now().year)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='streams')
    capacity = models.IntegerField(default=40)
    created_at = models.DateTimeField(auto_now_add=True)

    # Managers
    objects = models.Manager()
    school_objects = SchoolManager()  # Your custom manager using get_current_school

    class Meta:
        db_table = 'streams'
        verbose_name = 'Stream'
        verbose_name_plural = 'Streams'
        unique_together = ['name', 'class_assigned', 'year']
        ordering = ['class_assigned', 'name']

    def __str__(self):
        return f"{self.class_assigned.name} {self.name} ({self.year})"

    @property
    def current_enrollment(self):
        return self.students.filter(is_active=True).count()

class Student(SchoolScopedModel):
    """Model for students"""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
    ]
    
    is_on_transport = models.BooleanField(default=False)
    transport_route = models.ForeignKey(TransportRoute, on_delete=models.SET_NULL, null=True, blank=True)
    TRANSPORT_OPTIONS = (
        ('one_way', 'One Way'),
        ('two_way', 'Two Way'),
    )
    transport_type = models.CharField(max_length=8, choices=TRANSPORT_OPTIONS, null=True, blank=True)
    
    # Auto-generated admission number
    admission_number = models.CharField(max_length=20, unique=True, editable=False)
    level = models.CharField(max_length=2, choices=SchoolLevels.choices)
    # Personal Information
    full_name = models.CharField(max_length=200)
    gender = models.CharField(max_length=1, choices=[('M', 'Male'), ('F', 'Female')])
    date_of_birth = models.DateField()
    photo = models.ImageField(upload_to=student_photo_path, blank=True, null=True)
    
    # Academic Information
    kcpe_index = models.CharField(max_length=20, blank=True, help_text="KCPE Index Number")
    current_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True)
    current_stream = models.ForeignKey(Stream, on_delete=models.SET_NULL, null=True, related_name='students')
    admission_year = models.IntegerField(default=timezone.now().year)
    
    # Guardian Information
    guardian_name = models.CharField(max_length=200)
    guardian_phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^\+?254[0-9]{9}$|^0[0-9]{9}$',
            message="Enter a valid Kenyan phone number"
        )]
    )
    guardian_email = models.EmailField(blank=True)
    guardian_relationship = models.CharField(max_length=50, default="Parent")
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'students'
        verbose_name = 'Student'
        verbose_name_plural = 'Students'
        ordering = ['admission_number']
    
    def save(self, *args, **kwargs):
        if not self.admission_number:
            self.admission_number = self.generate_admission_number()
        super().save(*args, **kwargs)
    
    def generate_admission_number(self):
        """Generate admission number in format YYYY-NNNN"""
        year = self.admission_year
        last_student = Student.objects.filter(
            admission_year=year
        ).order_by('admission_number').last()
        
        if last_student and last_student.admission_number:
            try:
                last_num = int(last_student.admission_number.split('-')[1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        
        return f"{year}-{new_num:04d}"
    
    def __str__(self):
        return f"{self.admission_number} - {self.full_name}"
    
    @property
    def age(self):
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    @property
    def current_class_stream(self):
        if self.current_class and self.current_stream:
            return f"{self.current_class.name} {self.current_stream.name}"
        return "Not Assigned"

class StudentTransfer(models.Model):
    """Model to track student transfers between classes/streams"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transfers')
    from_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name='transfers_from')
    from_stream = models.ForeignKey(Stream, on_delete=models.SET_NULL, null=True, related_name='transfers_from')
    to_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name='transfers_to')
    to_stream = models.ForeignKey(Stream, on_delete=models.SET_NULL, null=True, related_name='transfers_to')
    transfer_date = models.DateTimeField(default=timezone.now)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'student_transfers'
        verbose_name = 'Student Transfer'
        verbose_name_plural = 'Student Transfers'
        ordering = ['-transfer_date']
    
    def __str__(self):
        return f"{self.student.full_name} transfer on {self.transfer_date.date()}"

class StudentPromotion(models.Model):
    """Model to track student promotions"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='promotions')
    from_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name='promotions_from')
    to_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name='promotions_to')
    academic_year = models.IntegerField()
    promotion_date = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'student_promotions'
        verbose_name = 'Student Promotion'
        verbose_name_plural = 'Student Promotions'
        ordering = ['-promotion_date']
    
    def __str__(self):
        return f"{self.student.full_name} promoted {self.academic_year}"
class ClassSubjectAllocation(models.Model):
    academic_year = models.IntegerField()
    term = models.IntegerField(choices=[(1, 'Term 1'), (2, 'Term 2'), (3, 'Term 3')])
    school_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    stream = models.ForeignKey(Stream, on_delete=models.CASCADE)
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE)
    subject_teacher = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='teaching_subjects')
    class_teacher = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='class_teacher_assignments')

    class Meta:
        unique_together = ['academic_year', 'term', 'school_class', 'stream', 'subject']
        verbose_name = 'Class Subject Allocation'
        verbose_name_plural = 'Class Subject Allocations'

    def __str__(self):
        return f"{self.school_class.name} {self.stream.name} - {self.subject.name} (T{self.term} {self.academic_year})"

