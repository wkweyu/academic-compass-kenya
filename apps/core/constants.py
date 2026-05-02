from django.db import models

class SchoolLevels(models.TextChoices):
    PP = 'PP', 'Pre-Primary'
    LP = 'LP', 'Lower Primary'
    UP = 'UP', 'Upper Primary'
    LS = 'LS', 'Lower Secondary'
    SS = 'SS', 'Senior Secondary'
