from django.db import models
from core.middleware import get_current_school
from core.managers import SchoolManager

class SchoolScopedModel(models.Model):
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE)

    objects = SchoolManager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.school_id:
            self.school = get_current_school()
        super().save(*args, **kwargs)
