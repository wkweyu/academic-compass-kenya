from django.db import models
from apps.schools.models import School
from apps.core.managers import SchoolManager

# Create your models here.
class TermSetting(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='term_settings')
    year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    objects = models.Manager()  # Default manager

    class Meta:
        unique_together = ('school', 'year', 'term')

    def __str__(self):
        return f"{self.school.name} | {self.year} Term {self.term}"
