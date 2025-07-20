
from django.apps import AppConfig

class ExamsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.exams'
    label = 'exams'

def ready(self):
        # Ensure models are only loaded once
        from apps.exams import models
        models.ExamType._meta.app_label = 'exams'