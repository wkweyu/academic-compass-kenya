# teachers/api_views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from .models import Teacher, TeacherSubjectAssignment
from .serializers import TeacherSerializer, TeacherSubjectAssignmentSerializer

class TeacherViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing teachers/staff
    """
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter teachers by user's school and support search
        """
        # Get user's school
        user_school = getattr(self.request.user, 'school', None)
        if not user_school:
            return Teacher.objects.none()
        
        queryset = Teacher.objects.filter(school=user_school)
        
        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(tsc_number__icontains=search) |
                Q(email__icontains=search) |
                Q(employee_no__icontains=search)
            )
        
        # Status filter
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Staff category filter
        staff_category = self.request.query_params.get('staff_category', None)
        if staff_category:
            queryset = queryset.filter(staff_category=staff_category)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """
        Automatically set school from authenticated user
        """
        user_school = getattr(self.request.user, 'school', None)
        if not user_school:
            raise ValidationError('User does not have a school assigned.')
        serializer.save(school=user_school)
    
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
        Get teacher/staff statistics for the user's school
        """
        user_school = getattr(request.user, 'school', None)
        if not user_school:
            return Response({'error': 'No school assigned'}, status=status.HTTP_400_BAD_REQUEST)
        
        queryset = Teacher.objects.filter(school=user_school)
        
        stats = {
            'total_teachers': queryset.count(),
            'active_teachers': queryset.filter(is_active=True).count(),
            'inactive_teachers': queryset.filter(is_active=False).count(),
            'teaching_staff': queryset.filter(staff_category='Teaching Staff').count(),
            'admin_staff': queryset.filter(staff_category='Administrative Staff').count(),
        }
        
        return Response(stats)
