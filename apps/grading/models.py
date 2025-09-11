
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class GradeScale(models.Model):
    """Customizable grading scale"""
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE)
    academic_year = models.IntegerField(default=timezone.now().year)
    grade = models.CharField(max_length=2)
    min_score = models.DecimalField(max_digits=5, decimal_places=2)
    max_score = models.DecimalField(max_digits=5, decimal_places=2)
    points = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    remarks = models.CharField(max_length=255, blank=True)

    class Meta:
        app_label = 'exams'
        db_table = 'grade_scales'
        ordering = ['-min_score']
        unique_together = ['school', 'academic_year', 'grade']

    def __str__(self):
        return f"{self.grade} ({self.min_score}-{self.max_score})"


class Score(models.Model):
    """Model for student exam scores"""
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='scores')
    exam = models.ForeignKey('exams.Exam', on_delete=models.CASCADE, related_name='scores')
    marks = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    grade = models.CharField(max_length=5, blank=True)
    position = models.PositiveIntegerField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    is_absent = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    entered_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        app_label = 'grading'
        db_table = 'scores'
        verbose_name = 'Score'
        verbose_name_plural = 'Scores'
        unique_together = ['student', 'exam']
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Allow grade_scale_rules to be passed in to avoid re-querying in loops
        grade_scale_rules = kwargs.pop('grade_scale_rules', None)

        if not self.is_absent and self.marks is not None:
            self.grade = self.calculate_grade(grade_scale_rules=grade_scale_rules)

        super().save(*args, **kwargs)

    def calculate_grade(self, grade_scale_rules=None):
        """
        Calculates the grade for the score based on the percentage.
        Accepts an optional `grade_scale_rules` queryset to prevent N+1 queries in batch operations.
        """
        if self.exam.max_marks is None or self.exam.max_marks <= 0 or self.marks is None:
            return 'N/A'

        try:
            percentage = (self.marks / self.exam.max_marks) * 100
        except (TypeError, ValueError):
            return 'N/A'

        # Use pre-fetched rules if provided
        if grade_scale_rules is not None:
            for rule in grade_scale_rules:
                if rule.min_score <= percentage <= rule.max_score:
                    return rule.grade
            return 'N/A'

        # Fallback to a DB query if rules are not provided (e.g., for single saves via admin)
        grade_scale = GradeScale.objects.filter(
            school=self.exam.school, # Use the direct FK from exam to school
            academic_year=self.exam.academic_year,
            min_score__lte=percentage,
            max_score__gte=percentage
        ).first()

        return grade_scale.grade if grade_scale else 'N/A'

    @property
    def percentage(self):
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
        app_label = 'grading'
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
