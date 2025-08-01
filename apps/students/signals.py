from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Student
from apps.core.middleware import get_current_school

@receiver(pre_save, sender=Student)
def set_admission_number(sender, instance, **kwargs):
    # Ensure school is set first
    if not instance.school:
        instance.school = get_current_school()

    # Now it's safe to access school
    if not instance.admission_number:
        last = Student.objects.filter(school=instance.school).order_by('-admission_number').first()
        try:
            last_num = int(last.admission_number.split('-')[1]) if last else 1000
        except (IndexError, ValueError):
            last_num = 1000
        next_number = last_num + 1
        instance.admission_number = f"{instance.admission_year}-{next_number:04d}"
