# teachers/api_views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Teacher, TeacherSubjectAssignment
from .serializers import TeacherSerializer, TeacherSubjectAssignmentSerializer

class TeacherViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing teachers
    """
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter teachers and support search
        """
        queryset = Teacher.objects.all()
        
        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(tsc_number__icontains=search) |
                Q(email__icontains=search)
            )
        
        # Status filter
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def subjects(self, request, pk=None):
        """
        Get all subject assignments for a specific teacher
        """
        teacher = self.get_object()
        assignments = TeacherSubjectAssignment.objects.filter(
            teacher=teacher, 
            is_active=True
        ).select_related('subject', 'class_assigned', 'stream')
        
        serializer = TeacherSubjectAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get teacher statistics
        """
        queryset = self.get_queryset()
        
        stats = {
            'total_teachers': queryset.count(),
            'active_teachers': queryset.filter(is_active=True).count(),
            'inactive_teachers': queryset.filter(is_active=False).count(),
        }
        
        return Response(stats)
