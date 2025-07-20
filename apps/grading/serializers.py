from apps.grading.models import GradeScale
from rest_framework import serializers


class GradeScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeScale
        fields = '__all__'

