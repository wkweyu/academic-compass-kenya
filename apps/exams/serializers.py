from rest_framework import serializers
from .models import ReportCardConfig

class ReportCardConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportCardConfig
        fields = '__all__'