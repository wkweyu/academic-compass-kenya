from django.db import models
from core.middleware import get_current_school

class SchoolQuerySet(models.QuerySet):
    def for_current_school(self):
        school = get_current_school()
        return self.filter(school=school)

class SchoolManager(models.Manager):
    def get_queryset(self):
        return SchoolQuerySet(self.model, using=self._db).for_current_school()
