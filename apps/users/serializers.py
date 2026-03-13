from rest_framework import serializers
from apps.schools.serializers import SchoolSerializer
from .models import User  # Make sure you're importing your User model correctly

class UserSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role', 'school']