from apps.settings.models import TermSetting
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

class ExamType(models.Model):
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='exam_types')
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'exams'
        unique_together = ['school', 'name']
        ordering = ['name']

    def __str__(self):
        return f"{self.name}"

class Exam(models.Model):
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='exams',null=True, blank=True)
    name = models.CharField(max_length=200)
    exam_type = models.ForeignKey(ExamType, on_delete=models.CASCADE, related_name='exams')
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE, related_name='exams')
    class_assigned = models.ForeignKey('students.Class', on_delete=models.CASCADE, related_name='exams')
    stream = models.ForeignKey('students.Stream', on_delete=models.SET_NULL, null=True, blank=True, related_name='exams')

    term = models.ForeignKey('settings.TermSetting', on_delete=models.CASCADE, related_name='exams')
    academic_year = models.IntegerField(default=timezone.now().year)
    exam_date = models.DateField()
    max_marks = models.PositiveIntegerField(default=100, validators=[MinValueValidator(1)])
    duration_minutes = models.PositiveIntegerField(default=60)
    instructions = models.TextField(blank=True)
    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['name', 'exam_type', 'subject', 'class_assigned', 'stream', 'term', 'academic_year']
        ordering = ['-exam_date']

    def __str__(self):
        stream_info = f" {self.stream.name}" if self.stream else ""
        return f"{self.name} - {self.subject.name} ({self.class_assigned.name}{stream_info})"



class ReportCardExamSelection(models.Model):
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='report_card_selections')
    term = models.ForeignKey('settings.TermSetting', on_delete=models.CASCADE, related_name='report_card_selections')
    academic_year = models.IntegerField(default=timezone.now().year)
    exam_type = models.ForeignKey(ExamType, on_delete=models.CASCADE, related_name='report_card_selections')
    is_included = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['school', 'term', 'academic_year', 'exam_type']
        ordering = ['exam_type']

    def __str__(self):
        return f"{self.term.term} {self.exam_type.name}"


class ReportCardConfig(models.Model):
    """Decide which exams contribute to term report cards"""
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='reportcard_configs')
    academic_year = models.IntegerField()
    term = models.ForeignKey('settings.TermSetting', on_delete=models.CASCADE)
    exams = models.ManyToManyField('exams.Exam', related_name='reportcard_configs')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    configured_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        unique_together = ['school', 'academic_year', 'term']
        verbose_name = 'Report Card Config'
        verbose_name_plural = 'Report Card Configs'

    def __str__(self):
        return f"{self.school.name} - Term {self.term.term_name} {self.academic_year}"
