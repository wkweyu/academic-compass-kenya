
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class Score(models.Model):
    """Model for student exam scores"""
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='scores')
    exam = models.ForeignKey('exams.Exam', on_delete=models.CASCADE, related_name='scores')
    marks = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    # Additional fields
    grade = models.CharField(max_length=2, blank=True)  # A, B, C, D, E
    remarks = models.TextField(blank=True)
    is_absent = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    entered_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'scores'
        verbose_name = 'Score'
        verbose_name_plural = 'Scores'
        unique_together = ['student', 'exam']
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        # Auto-calculate grade based on marks
        if not self.is_absent and self.marks is not None:
            self.grade = self.calculate_grade()
        super().save(*args, **kwargs)
    
    def calculate_grade(self):
        """Calculate grade based on marks percentage"""
        if self.exam.max_marks <= 0:
            return 'E'
        
        percentage = (float(self.marks) / self.exam.max_marks) * 100
        
        if percentage >= 80:
            return 'A'
        elif percentage >= 70:
            return 'B'
        elif percentage >= 60:
            return 'C'
        elif percentage >= 50:
            return 'D'
        else:
            return 'E'
    
    @property
    def percentage(self):
        """Calculate percentage score"""
        if self.exam.max_marks <= 0 or self.is_absent:
            return 0
        return round((float(self.marks) / self.exam.max_marks) * 100, 2)
    
    def __str__(self):
        if self.is_absent:
            return f"{self.student.full_name} - {self.exam.name} (Absent)"
        return f"{self.student.full_name} - {self.exam.name}: {self.marks}/{self.exam.max_marks}"

class StudentReport(models.Model):
    """Model for generating student reports"""
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='reports')
    term = models.IntegerField(choices=[(1, 'Term 1'), (2, 'Term 2'), (3, 'Term 3')])
    academic_year = models.IntegerField(default=timezone.now().year)
    
    # Calculated fields
    total_marks = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    average_marks = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    overall_grade = models.CharField(max_length=2, blank=True)
    class_position = models.IntegerField(null=True, blank=True)
    stream_position = models.IntegerField(null=True, blank=True)
    
    # Comments
    teacher_comment = models.TextField(blank=True)
    head_teacher_comment = models.TextField(blank=True)
    
    # Status
    is_published = models.BooleanField(default=False)
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    generated_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'student_reports'
        verbose_name = 'Student Report'
        verbose_name_plural = 'Student Reports'
        unique_together = ['student', 'term', 'academic_year']
        ordering = ['-academic_year', '-term', 'student']
    
    def __str__(self):
        return f"{self.student.full_name} - Term {self.term} {self.academic_year}"
    
    def calculate_totals(self):
        """Calculate total marks and average for this report"""
        scores = Score.objects.filter(
            student=self.student,
            exam__term=self.term,
            exam__academic_year=self.academic_year,
            is_absent=False
        )
        
        if scores.exists():
            self.total_marks = sum(score.marks for score in scores)
            self.average_marks = self.total_marks / scores.count()
            
            # Calculate overall grade
            avg_percentage = (float(self.average_marks) / 100) * 100  # Assuming max is 100
            if avg_percentage >= 80:
                self.overall_grade = 'A'
            elif avg_percentage >= 70:
                self.overall_grade = 'B'
            elif avg_percentage >= 60:
                self.overall_grade = 'C'
            elif avg_percentage >= 50:
                self.overall_grade = 'D'
            else:
                self.overall_grade = 'E'
        
        self.save()
