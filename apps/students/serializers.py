from rest_framework import serializers
from .models import Student, Class, Stream
from apps.core.middleware import get_current_school

class StudentSerializer(serializers.ModelSerializer):
    # Make some fields read-only as they are auto-generated
    admission_number = serializers.CharField(read_only=True)

    # Display human-readable names for foreign keys
    current_class_name = serializers.CharField(source='current_class.name', read_only=True)
    current_stream_name = serializers.CharField(source='current_stream.name', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'full_name', 'date_of_birth', 'gender',
            'guardian_name', 'guardian_phone', 'guardian_email',
            'current_class', 'current_stream', 'current_class_name', 'current_stream_name',
            'enrollment_date', 'status', 'photo', 'is_active'
        ]
        read_only_fields = ['id', 'is_active', 'admission_number']

    def create(self, validated_data):
        # Assign the school from the request context (set by middleware)
        school = get_current_school()
        if school:
            validated_data['school'] = school

        # You might need to handle the photo upload manually if needed

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Handle photo updates carefully
        return super().update(instance, validated_data)


class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        # include only the fields you want to expose to the frontend
        fields = [
            'id', 
            'name', 
            'grade_level', 
            'description'
        ]
        read_only_fields = ['id']

class StreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stream
        fields = [
            'id',
            'name',
            'class_assigned'  # FK to Class
        ]
        read_only_fields = ['id']