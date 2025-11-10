from django.db import models
from apps.students.models import Student
from apps.core.models import SchoolScopedModel

class Attendance(SchoolScopedModel):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    date = models.DateField()
    time_in = models.TimeField()
    time_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=10, default='present')
    notes = models.TextField(blank=True)
    reason = models.TextField(blank=True)

    class Meta:
        db_table = 'attendance'
        unique_together = ('student', 'date')
