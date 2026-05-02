
from django.db import models
from django.utils import timezone

class Subject(models.Model):
    """Model for school subjects"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True, help_text="Subject code (e.g., ENG, MAT, SCI)")
    description = models.TextField(blank=True)
    is_core = models.BooleanField(default=True, help_text="Is this a core subject?")
    grade_levels = models.CharField(
        max_length=50, 
        help_text="Grade levels this subject is taught (e.g., 1-8, 4-8)",
        default="1-8"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'subjects'
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.code})"
