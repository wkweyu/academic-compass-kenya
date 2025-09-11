from django.db import models

# Create your models here.

class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, unique=True, editable=False)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        app_label = 'schools'
        verbose_name = 'School'

    def save(self, *args, **kwargs):
        if not self.code:  # Only generate code for new instances
            last_school = School.objects.order_by('id').last()
            if last_school:
                last_id = last_school.id
            else:
                last_id = 0
            self.code = f"SCH{last_id + 1:04d}"  # Formats as SCH0001, SCH0002, etc.
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"