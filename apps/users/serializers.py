from rest_framework import serializers
from apps.schools.serializers import SchoolSerializer
from .models import User  # Make sure you're importing your User model correctly

class UserSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'school']
        # Note: Roles are managed via Supabase user_roles table