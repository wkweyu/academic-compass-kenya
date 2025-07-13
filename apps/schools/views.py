from django.shortcuts import render
from rest_framework import generics, permissions
from .models import School
from .serializers import SchoolSerializer

class SchoolListCreateView(generics.ListCreateAPIView):
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

