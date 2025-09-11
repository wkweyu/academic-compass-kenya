from django.db import models
from apps.core.models import SchoolScopedModel

class TransportRoute(SchoolScopedModel):
    name = models.CharField(max_length=255)
    one_way_charge = models.DecimalField(max_digits=10, decimal_places=2)
    two_way_charge = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name}"
