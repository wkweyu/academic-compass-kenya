from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import ActivityLog, Lead, OnboardingProgress, School, SchoolHealthSnapshot, SchoolTask, UpsellOpportunity
from .serializers import (
    ActivityLogSerializer,
    AvailableStaffQuerySerializer,
    LeadCreateSerializer,
    LeadSerializer,
    LeadStageTransitionSerializer,
    OnboardingStepProcessSerializer,
    SchoolHealthSnapshotSerializer,
    SchoolSerializer,
    SchoolTransferSerializer,
    SchoolTaskCreateSerializer,
    SchoolTaskSerializer,
    SchoolTaskStatusSerializer,
    UpsellOpportunitySerializer,
)
from .services import (
    calculate_school_health_score,
    can_accept_assignment,
    convert_lead_to_school,
    create_lead,
    create_school_task,
    detect_upsell_opportunities,
    find_available_staff,
    get_school_health_overview,
    get_staff_capacity_alerts,
    get_staff_workload,
    identify_at_risk_schools,
    get_onboarding_progress_snapshot,
    process_onboarding_step,
    transfer_school_assignment,
    transition_lead_stage,
    update_school_task_status,
)


PLATFORM_STAFF_ROLES = {'staff', 'sales_rep', 'onboarding_specialist', 'account_manager', 'manager'}


def _is_platform_staff(user):
    role = (getattr(user, 'role', '') or '').lower()
    return bool(user.is_superuser or user.is_staff or (not getattr(user, 'school_id', None) and role in PLATFORM_STAFF_ROLES))


def _ensure_school_access(request, school):
    if _is_platform_staff(request.user):
        return school
    if getattr(request.user, 'school_id', None) != school.id:
        raise PermissionDenied('You do not have access to this school.')
    return school


def _ensure_platform_staff(request):
    if _is_platform_staff(request.user):
        return request.user
    raise PermissionDenied('Only platform staff can access this endpoint.')


def _service_error(exc):
    if hasattr(exc, 'message_dict'):
        return ValidationError(exc.message_dict)
    if hasattr(exc, 'messages'):
        return ValidationError(exc.messages)
    return ValidationError(str(exc))

class SchoolDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if getattr(self.request.user, 'school', None):
            return self.request.user.school
        return School.objects.first()

    def get(self, request, *args, **kwargs):
        school = self.get_object()
        if not school:
            return Response({"detail": "School profile not found. Please create one."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(school)
        return Response(serializer.data)

class SchoolCreateView(generics.CreateAPIView):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        # Check if user already has a school
        user = request.user
        if user.school:
            return Response(
                {"detail": "You already have a school profile. You can update it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if a school already exists globally (single-school mode)
        if School.objects.exists():
            existing_school = School.objects.first()
            # Link the user to the existing school
            user.school = existing_school
            user.save()
            serializer = self.get_serializer(existing_school)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        school = serializer.instance

        # Associate this school with the user who created it
        user.school = school
        user.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class LeadListCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = Lead.objects.select_related('school', 'assigned_to', 'created_by', 'updated_by')
        if not _is_platform_staff(request.user):
            queryset = queryset.filter(school_id=request.user.school_id)

        stage = request.query_params.get('stage')
        if stage:
            queryset = queryset.filter(stage=stage)

        assigned_to = request.query_params.get('assigned_to')
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        serializer = LeadSerializer(queryset.order_by('-created_at'), many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        serializer = LeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            lead = create_lead(
                staff_id=request.user.id,
                school_name=payload['school_name'],
                school_email=payload.get('school_email', ''),
                school_phone=payload.get('school_phone', ''),
                school_address=payload.get('school_address', ''),
                source=payload.get('source', ''),
                priority=payload.get('priority') or 'MEDIUM',
                notes=payload.get('notes', ''),
                assigned_to_id=payload.get('assigned_to_id'),
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(LeadSerializer(lead).data, status=status.HTTP_201_CREATED)


class LeadConvertView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lead_id, *args, **kwargs):
        lead = get_object_or_404(Lead.objects.select_related('school'), pk=lead_id)
        _ensure_school_access(request, lead.school)
        try:
            school, progress = convert_lead_to_school(lead_id=lead_id, staff_id=request.user.id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(
            {
                'school': SchoolSerializer(school).data,
                'onboarding_progress': get_onboarding_progress_snapshot(school_id=progress.school_id),
            }
        )


class LeadStageTransitionView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LeadStageTransitionSerializer

    def post(self, request, lead_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = get_object_or_404(Lead.objects.select_related('school'), pk=lead_id)
        _ensure_school_access(request, lead.school)
        try:
            result = transition_lead_stage(
                lead_id=lead_id,
                staff_id=request.user.id,
                new_stage=serializer.validated_data['new_stage'],
                loss_reason=serializer.validated_data.get('loss_reason', ''),
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        result_lead = Lead.objects.select_related('school').get(pk=result['lead'].id)
        return Response(
            {
                'lead': LeadSerializer(result_lead).data,
                'school': SchoolSerializer(result['school']).data,
                'onboarding_progress': get_onboarding_progress_snapshot(school_id=result['school'].id)
                if result.get('onboarding_progress')
                else None,
            }
        )


class OnboardingProgressDetailView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        try:
            snapshot = get_onboarding_progress_snapshot(school_id=school_id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(snapshot)


class OnboardingStepProcessView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OnboardingStepProcessSerializer

    def post(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            progress = process_onboarding_step(
                school_id=school_id,
                staff_id=request.user.id,
                step=serializer.validated_data['step'],
                step_data=serializer.validated_data.get('step_data') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(get_onboarding_progress_snapshot(school_id=progress.school_id))


class SchoolTaskListCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = SchoolTask.objects.select_related('school', 'assigned_to', 'onboarding_progress', 'lead')
        if not _is_platform_staff(request.user):
            queryset = queryset.filter(school_id=request.user.school_id)

        school_id = request.query_params.get('school_id')
        if school_id:
            school = get_object_or_404(School, pk=school_id)
            _ensure_school_access(request, school)
            queryset = queryset.filter(school_id=school_id)

        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if request.query_params.get('assigned_to_me') == 'true':
            queryset = queryset.filter(assigned_to=request.user)

        if request.query_params.get('overdue') == 'true':
            queryset = queryset.filter(due_at__lt=timezone.now()).exclude(status='COMPLETE')

        serializer = SchoolTaskSerializer(queryset.order_by('due_at', '-created_at'), many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        serializer = SchoolTaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school = get_object_or_404(School, pk=payload['school_id'])
        _ensure_school_access(request, school)
        onboarding_progress = None
        if payload.get('onboarding_progress_id'):
            onboarding_progress = get_object_or_404(OnboardingProgress, pk=payload['onboarding_progress_id'], school=school)
        lead = None
        if payload.get('lead_id'):
            lead = get_object_or_404(Lead, pk=payload['lead_id'], school=school)
        assigned_to = None
        if payload.get('assigned_to_id'):
            from apps.users.models import User

            assigned_to = get_object_or_404(User, pk=payload['assigned_to_id'])
        try:
            task = create_school_task(
                school=school,
                created_by=request.user,
                title=payload['title'],
                description=payload.get('description', ''),
                assigned_to=assigned_to,
                due_at=payload.get('due_at'),
                step=payload.get('step', ''),
                onboarding_progress=onboarding_progress,
                lead=lead,
                is_required=payload.get('is_required', True),
                metadata=payload.get('metadata') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(SchoolTaskSerializer(task).data, status=status.HTTP_201_CREATED)


class SchoolTaskStatusView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SchoolTaskStatusSerializer

    def post(self, request, task_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = get_object_or_404(SchoolTask.objects.select_related('school'), pk=task_id)
        _ensure_school_access(request, task.school)
        try:
            updated_task = update_school_task_status(
                school_id=task.school_id,
                task_id=task.id,
                staff_id=request.user.id,
                status=serializer.validated_data['status'],
                blocked_reason=serializer.validated_data.get('blocked_reason', ''),
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(SchoolTaskSerializer(updated_task).data)


class ActivityLogListView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ActivityLog.objects.select_related('school', 'actor', 'lead', 'onboarding_progress', 'task')
        school_id = self.request.query_params.get('school_id')
        if school_id:
            school = get_object_or_404(School, pk=school_id)
            _ensure_school_access(self.request, school)
            queryset = queryset.filter(school_id=school_id)
        elif not _is_platform_staff(self.request.user):
            queryset = queryset.filter(school_id=self.request.user.school_id)
        return queryset.order_by('-created_at')


class StaffWorkloadDetailView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, staff_id, *args, **kwargs):
        _ensure_platform_staff(request)
        try:
            workload = get_staff_workload(staff_id=staff_id)
            assignment_check = can_accept_assignment(
                staff_id=staff_id,
                assignment_type=request.query_params.get('assignment_type') or workload['assignment_type'],
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        workload['can_accept_assignment'] = assignment_check['can_accept']
        workload['can_accept_reason'] = assignment_check['reason']
        return Response(workload)


class AvailableStaffView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AvailableStaffQuerySerializer

    def get(self, request, *args, **kwargs):
        _ensure_platform_staff(request)
        serializer = self.get_serializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            available_staff = find_available_staff(
                role=serializer.validated_data['role'],
                assignment_type=serializer.validated_data.get('assignment_type') or None,
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(available_staff)


class StaffCapacityAlertsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        _ensure_platform_staff(request)
        threshold_percent = request.query_params.get('threshold_percent') or 80
        try:
            alerts = get_staff_capacity_alerts(threshold_percent=float(threshold_percent))
        except (TypeError, ValueError):
            raise ValidationError({'threshold_percent': 'Threshold percent must be a number.'})
        return Response({'results': alerts})


class SchoolTransferView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SchoolTransferSerializer

    def post(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = transfer_school_assignment(
                school_id=school_id,
                initiated_by_id=request.user.id,
                target_staff_id=serializer.validated_data['target_staff_id'],
                reason=serializer.validated_data['reason'],
                notes=serializer.validated_data.get('notes', ''),
                transfer_items=serializer.validated_data.get('transfer_items') or None,
                reassign_open_tasks=serializer.validated_data.get('reassign_open_tasks', True),
                schedule_intro_call=serializer.validated_data.get('schedule_intro_call', False),
                intro_call_due_at=serializer.validated_data.get('intro_call_due_at'),
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(
            {
                'school': SchoolSerializer(result['school']).data,
                'onboarding_progress': get_onboarding_progress_snapshot(school_id=school_id)
                if result.get('onboarding_progress')
                else None,
                'transferred_task_ids': result['transferred_task_ids'],
                'intro_call_task_id': result['intro_call_task_id'],
                'target_workload': result['capacity_check'],
            }
        )


class SchoolHealthOverviewView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        try:
            overview = get_school_health_overview(school_id=school_id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(overview)


class SchoolHealthCalculateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        try:
            snapshot = calculate_school_health_score(school_id=school_id, actor_id=request.user.id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(SchoolHealthSnapshotSerializer(snapshot).data)


class AtRiskSchoolsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        _ensure_platform_staff(request)
        try:
            results = identify_at_risk_schools(actor_id=request.user.id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response({'results': results})


class SchoolUpsellOpportunityListView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        queryset = UpsellOpportunity.objects.filter(school=school).order_by('priority', '-created_at')
        return Response(UpsellOpportunitySerializer(queryset, many=True).data)


class SchoolUpsellOpportunityDetectView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, school_id, *args, **kwargs):
        school = get_object_or_404(School, pk=school_id)
        _ensure_school_access(request, school)
        try:
            opportunities = detect_upsell_opportunities(school_id=school_id, actor_id=request.user.id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response({'results': opportunities})