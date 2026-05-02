# teachers/api_views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from .models import Teacher, TeacherSubjectAssignment
from .serializers import TeacherSerializer, TeacherSubjectAssignmentSerializer
import logging

logger = logging.getLogger(__name__)

class TeacherViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing teachers/staff with enhanced debugging
    """
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter teachers by user's school and support search"""
        user = self.request.user
        logger.info(f"[TEACHERS] get_queryset called by: {user.email}")
        
        # Get user's school
        user_school = getattr(user, 'school', None)
        logger.info(f"[TEACHERS] User school: {user_school}")
        logger.info(f"[TEACHERS] User school_id: {getattr(user, 'school_id', None)}")
        
        if not user_school:
            logger.error(f"[TEACHERS] User {user.email} has NO school assigned!")
            return Teacher.objects.none()
        
        queryset = Teacher.objects.filter(school=user_school)
        logger.info(f"[TEACHERS] Base queryset count: {queryset.count()}")
        
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
            logger.info(f"[TEACHERS] Applied search filter: {search}, new count: {queryset.count()}")
        
        # Status filter
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
            logger.info(f"[TEACHERS] Applied is_active filter: {is_active}")
        
        # Staff category filter
        staff_category = self.request.query_params.get('staff_category', None)
        if staff_category:
            queryset = queryset.filter(staff_category=staff_category)
            logger.info(f"[TEACHERS] Applied staff_category filter: {staff_category}")
        
        final_count = queryset.count()
        logger.info(f"[TEACHERS] Returning {final_count} teachers")
        return queryset.order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """Override list to add detailed logging"""
        logger.info("=" * 60)
        logger.info(f"[TEACHERS LIST] Request from: {request.user.email}")
        logger.info(f"[TEACHERS LIST] Query params: {dict(request.query_params)}")
        logger.info(f"[TEACHERS LIST] Headers: Authorization={bool(request.META.get('HTTP_AUTHORIZATION'))}")
        
        try:
            response = super().list(request, *args, **kwargs)
            result_count = len(response.data.get('results', response.data if isinstance(response.data, list) else []))
            logger.info(f"[TEACHERS LIST] Success! Returned {result_count} teachers")
            logger.info("=" * 60)
            return response
        except Exception as e:
            logger.error(f"[TEACHERS LIST] ERROR: {str(e)}", exc_info=True)
            logger.info("=" * 60)
            raise
    
    def create(self, request, *args, **kwargs):
        """Override create to add detailed logging"""
        logger.info("=" * 60)
        logger.info(f"[TEACHERS CREATE] Request from: {request.user.email}")
        logger.info(f"[TEACHERS CREATE] User school: {getattr(request.user, 'school', None)}")
        logger.info(f"[TEACHERS CREATE] User school_id: {getattr(request.user, 'school_id', None)}")
        logger.info(f"[TEACHERS CREATE] Data keys: {list(request.data.keys())}")
        logger.info(f"[TEACHERS CREATE] First name: {request.data.get('first_name')}")
        logger.info(f"[TEACHERS CREATE] Last name: {request.data.get('last_name')}")
        logger.info(f"[TEACHERS CREATE] TSC number: {request.data.get('tsc_number')}")
        
        try:
            response = super().create(request, *args, **kwargs)
            logger.info(f"[TEACHERS CREATE] Success! Created teacher ID: {response.data.get('id')}")
            logger.info("=" * 60)
            return response
        except Exception as e:
            logger.error(f"[TEACHERS CREATE] ERROR: {str(e)}", exc_info=True)
            logger.info("=" * 60)
            return Response(
                {
                    "error": "Failed to create teacher",
                    "detail": str(e),
                    "type": type(e).__name__
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def perform_create(self, serializer):
        """Automatically set school from authenticated user"""
        user_school = getattr(self.request.user, 'school', None)
        logger.info(f"[TEACHERS perform_create] Assigning school: {user_school}")
        
        if not user_school:
            logger.error(f"[TEACHERS perform_create] ERROR: No school for user!")
            raise ValidationError('User does not have a school assigned. Please create a school profile first.')
        
        serializer.save(school=user_school)
        logger.info(f"[TEACHERS perform_create] Teacher saved successfully")
    
    @action(detail=True, methods=['get'])
    def subjects(self, request, pk=None):
        """Get all subject assignments for a specific teacher"""
        teacher = self.get_object()
        assignments = TeacherSubjectAssignment.objects.filter(
            teacher=teacher, 
            is_active=True
        ).select_related('subject', 'class_assigned', 'stream')
        
        serializer = TeacherSubjectAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get teacher/staff statistics for the user's school"""
        logger.info(f"[TEACHERS STATS] Request from: {request.user.email}")
        
        user_school = getattr(request.user, 'school', None)
        if not user_school:
            logger.error(f"[TEACHERS STATS] No school for user")
            return Response({'error': 'No school assigned'}, status=status.HTTP_400_BAD_REQUEST)
        
        queryset = Teacher.objects.filter(school=user_school)
        
        stats = {
            'total_teachers': queryset.count(),
            'active_teachers': queryset.filter(is_active=True).count(),
            'inactive_teachers': queryset.filter(is_active=False).count(),
            'teaching_staff': queryset.filter(staff_category='Teaching Staff').count(),
            'admin_staff': queryset.filter(staff_category='Administrative Staff').count(),
        }
        
        logger.info(f"[TEACHERS STATS] Returning: {stats}")
        return Response(stats)
