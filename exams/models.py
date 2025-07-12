
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

class Exam(models.Model):
    """Model for exams"""
    TERM_CHOICES = [
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    ]
    
    EXAM_TYPE_CHOICES = [
        ('CAT', 'Continuous Assessment Test'),
        ('MID', 'Mid-Term Exam'),
        ('END', 'End-Term Exam'),
        ('ANNUAL', 'Annual Exam'),
    ]
    
    name = models.CharField(max_length=200)
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE, related_name='exams')
    class_assigned = models.ForeignKey('students.Class', on_delete=models.CASCADE, related_name='exams')
    stream = models.ForeignKey('students.Stream', on_delete=models.CASCADE, null=True, blank=True, related_name='exams')
    
    term = models.IntegerField(choices=TERM_CHOICES)
    academic_year = models.IntegerField(default=timezone.now().year)
    exam_type = models.CharField(max_length=10, choices=EXAM_TYPE_CHOICES, default='CAT')
    
    exam_date = models.DateField()
    max_marks = models.IntegerField(default=100, validators=[MinValueValidator(1)])
    duration_minutes = models.IntegerField(default=60, help_text="Exam duration in minutes")
    
    instructions = models.TextField(blank=True, help_text="Special instructions for the exam")
    is_published = models.BooleanField(default=False, help_text="Are results published to students?")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'exams'
        verbose_name = 'Exam'
        verbose_name_plural = 'Exams'
        ordering = ['-exam_date', 'subject']
        unique_together = ['name', 'subject', 'class_assigned', 'stream', 'term', 'academic_year']
    
    def __str__(self):
        stream_info = f" {self.stream.name}" if self.stream else ""
        return f"{self.name} - {self.subject.name} ({self.class_assigned.name}{stream_info})"
    
    @property
    def total_students(self):
        """Get total number of students who should take this exam"""
        if self.stream:
            return self.stream.students.filter(is_active=True).count()
        else:
            return self.class_assigned.streams.aggregate(
                total=models.Count('students', filter=models.Q(students__is_active=True))
            )['total'] or 0
    
    @property
    def submitted_count(self):
        """Get number of students who have submitted"""
        return self.scores.count()
    
    @property
    def average_score(self):
        """Calculate average score for this exam"""
        scores = self.scores.aggregate(avg=models.Avg('marks'))
        return round(scores['avg'], 2) if scores['avg'] else 0
