from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.utils import timezone
import logging
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import (
    ActivityLog,
    CommunicationLog,
    FollowUp,
    Lead,
    NotificationRecord,
    NotificationTemplate,
    OnboardingProgress,
    School,
    SchoolHealthSnapshot,
    SchoolTask,
    UpsellOpportunity,
)
from .serializers import (
    ActivityLogSerializer,
    AvailableStaffQuerySerializer,
    CommunicationLogCreateSerializer,
    CommunicationLogSerializer,
    FollowUpCompleteSerializer,
    FollowUpCreateSerializer,
    FollowUpListQuerySerializer,
    FollowUpSerializer,
    FollowUpSnoozeSerializer,
    InitializeOnboardingSerializer,
    LeadCreateSerializer,
    LeadSerializer,
    LeadStageTransitionSerializer,
    NotificationListQuerySerializer,
    NotificationPreviewSerializer,
    NotificationRecordSerializer,
    NotificationSendSerializer,
    NotificationTemplateSerializer,
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
    complete_follow_up,
    convert_lead_to_school,
    create_lead,
    create_follow_up,
    create_school_task,
    detect_upsell_opportunities,
    ensure_default_notification_templates,
    find_available_staff,
    get_communication_timeline,
    get_follow_up_list,
    get_school_health_overview,
    get_notification_records,
    get_staff_capacity_alerts,
    get_staff_workload,
    get_todays_follow_ups,
    identify_at_risk_schools,
    initialize_school_onboarding,
    get_onboarding_progress_snapshot,
    log_communication,
    preview_notification_template,
    process_due_follow_ups,
    process_onboarding_step,
    send_notification,
    snooze_follow_up,
    transfer_school_assignment,
    transition_lead_stage,
    update_school_task_status,
)


PLATFORM_STAFF_ROLES = {
    'staff', 'sales_rep', 'onboarding_specialist', 'account_manager',
    'marketer', 'manager', 'platform_admin', 'support'
}

logger = logging.getLogger(__name__)


def _is_platform_staff(user):
    from .services import normalize_role
    role = normalize_role(getattr(user, 'role', ''))
    return bool(
        user.is_superuser or
        user.is_staff or
        (not getattr(user, 'school_id', None) and role in PLATFORM_STAFF_ROLES)
    )


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


class SchoolDeleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, school_id, *args, **kwargs):
        _ensure_platform_staff(request)
        school = get_object_or_404(School, pk=school_id)
        from .services import normalize_role
        requester_role = normalize_role(getattr(request.user, 'role', ''))
        if not (request.user.is_superuser or requester_role == 'platform_admin' or request.user.is_staff):
            raise PermissionDenied('Only platform administrators can delete schools.')

        logger.info(
            "Delete school request received | school_id=%s actor_id=%s",
            school_id,
            getattr(request.user, 'id', None),
        )

        def _table_has_column(table_name, column_name):
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = %s
                      AND column_name = %s
                    LIMIT 1
                    """,
                    [table_name, column_name],
                )
                return cursor.fetchone() is not None

        # We need a strict sequence because of foreign keys.
        # Order:
        # 1. Operational data with foreign keys to (Student, Teacher, Exam, Class, Stream)
        # 2. Student-related metadata (reports, transfers)
        # 3. Intermediate objects (Student, Teacher, Exam, Stream, Class)
        # 4. SaaS/Lead management data
        # 5. Users
        # 6. School itself

        with transaction.atomic():
            school_name = school.name
            with connection.cursor() as cursor:
                # Find IDs for sequenced cleanup
                cursor.execute('SELECT id FROM "users" WHERE "school_id" = %s', [school_id])
                user_ids = [row[0] for row in cursor.fetchall()]

                cursor.execute('SELECT id FROM "students" WHERE "school_id" = %s', [school_id])
                student_ids = [row[0] for row in cursor.fetchall()]

                cursor.execute('SELECT id FROM "teachers" WHERE "school_id" = %s', [school_id])
                teacher_ids = [row[0] for row in cursor.fetchall()]

                cursor.execute('SELECT id FROM "exams_exam" WHERE "school_id" = %s', [school_id])
                exam_ids = [row[0] for row in cursor.fetchall()]

                cursor.execute('SELECT id FROM "classes" WHERE "school_id" = %s', [school_id])
                class_ids = [row[0] for row in cursor.fetchall()]

                cursor.execute('SELECT id FROM "streams" WHERE "school_id" = %s', [school_id])
                stream_ids = [row[0] for row in cursor.fetchall()]

                def _safe_delete(table, column, ids):
                    if not ids: return
                    placeholders = ', '.join(['%s'] * len(ids))
                    try:
                        cursor.execute(f'DELETE FROM "{table}" WHERE "{column}" IN ({placeholders})', ids)
                    except Exception as e:
                        logger.warning("Failed delete from %s: %s", table, str(e))

                # Step 1: Clean up deep leaf records (Scores, Attendance, etc.)
                _safe_delete('scores', 'student_id', student_ids)
                _safe_delete('attendance', 'student_id', student_ids)
                _safe_delete('teacher_subject_assignments', 'teacher_id', teacher_ids)
                _safe_delete('student_reports', 'student_id', student_ids)
                _safe_delete('student_transfers', 'student_id', student_ids)
                _safe_delete('student_promotions', 'student_id', student_ids)
                _safe_delete('students_classsubjectallocation', 'school_class_id', class_ids)

                # Step 2: Clean up records with direct school_id (SaaS + Infrastructure)
                direct_tables = [
                    'schools_activitylog', 'schools_communicationlog', 'schools_followup',
                    'schools_notificationrecord', 'schools_schooltask', 'schools_onboardingprogress',
                    'schools_upsellopportunity', 'schools_lead', 'schools_schoolhealthsnapshot',
                    'schools_notificationtemplate', 'school_settings', 'subscriptions',
                    'saas_communications', 'saas_invoices', 'fees_feebalance', 'fees_feestructure',
                    'fees_paymenttransaction', 'fees_votehead', 'fees_debittransaction', 'grade_scales',
                    'iga_activity', 'iga_activitybudget', 'iga_activityexpense', 'iga_inventorymovement',
                    'iga_inventorystock', 'iga_producesale', 'iga_productionrecord', 'iga_product',
                    'settings_termsetting', 'transport_transportroute', 'procurement_supplier',
                    'procurement_itemcategory', 'procurement_item', 'procurement_lpo',
                    'procurement_stocktransaction', 'procurement_paymentvoucher',
                    'procurement_pettycashtransaction', 'procurement_feesinkindtransaction',
                    'exams_reportcardconfig', 'exams_reportcardexamselection', 'exams_examtype',
                    'school_portfolio_assignments', 'audit_logs', 'onboarding_logs'
                ]
                for table in direct_tables:
                    try:
                        cursor.execute(f'DELETE FROM "{table}" WHERE "school_id" = %s', [school_id])
                    except Exception: pass

                # Step 3: Delete intermediate objects
                _safe_delete('exams_exam', 'id', exam_ids)
                _safe_delete('students', 'id', student_ids)
                _safe_delete('teachers', 'id', teacher_ids)
                _safe_delete('streams', 'id', stream_ids)
                _safe_delete('classes', 'id', class_ids)

                # Step 4: Admin logs for users
                if user_ids:
                    cursor.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'django_admin_log' LIMIT 1")
                    if cursor.fetchone():
                        _safe_delete('django_admin_log', 'user_id', user_ids)

                # Step 5: Users and the School record
                cursor.execute('DELETE FROM "users" WHERE "school_id" = %s', [school_id])
                cursor.execute('DELETE FROM "schools_school" WHERE "id" = %s', [school_id])

                # Reset request local school to avoid holding onto deleted ID
                from apps.core.middleware import _request_local
                if getattr(_request_local, 'school', None) and _request_local.school.id == int(school_id):
                    _request_local.school = None

        logger.info(
            "Delete school completed | school_id=%s actor_id=%s school_name=%s",
            school_id,
            getattr(request.user, 'id', None),
            school_name,
        )
        return Response({'detail': 'School deleted successfully.'}, status=status.HTTP_200_OK)


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


class SchoolInitializeOnboardingView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InitializeOnboardingSerializer

    def post(self, request, school_id, *args, **kwargs):
        _ensure_platform_staff(request)
        school = get_object_or_404(School, pk=school_id)
        # Try to use request.user.id, fallback to school.assigned_staff_id if user is not authenticated through Django
        staff_id = getattr(request.user, 'id', None) or school.assigned_staff_id
        
        # In a SaaS context where Supabase handles auth, we might not have a Django user
        # but the request should have been authorized by middleware/Supabase
        if not staff_id:
            # Fallback for system-initiated or when auth user isn't correctly mapped
            from apps.users.models import User
            # Find any active platform staff or just the first superuser
            staff = User.objects.filter(is_active=True, is_staff=True).first()
            staff_id = staff.id if staff else None

        logger.info(
            "API onboarding init request received | school_id=%s actor_id=%s fallback_staff_id=%s",
            school_id,
            getattr(request.user, 'id', None),
            staff_id
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = initialize_school_onboarding(
                school_id=school_id,
                staff_id=staff_id,
                source=serializer.validated_data.get('source') or 'direct_onboarding',
                priority=serializer.validated_data.get('priority') or 'MEDIUM',
            )
        except DjangoValidationError as exc:
            logger.exception(
                "API onboarding init failed | school_id=%s actor_id=%s",
                school_id,
                getattr(request.user, 'id', None),
            )
            raise _service_error(exc)
        logger.info(
            "API onboarding init completed | school_id=%s lead_created=%s",
            school_id,
            result.get('lead_created'),
        )
        return Response(
            {
                'school': SchoolSerializer(result['school']).data,
                'lead': LeadSerializer(result['lead']).data,
                'lead_created': result['lead_created'],
                'onboarding_progress': get_onboarding_progress_snapshot(school_id=result['school'].id),
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


class CommunicationLogListCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school_id = request.query_params.get('school_id')
        if school_id:
            school = get_object_or_404(School, pk=school_id)
            _ensure_school_access(request, school)
        elif not _is_platform_staff(request.user):
            school_id = request.user.school_id

        actor_id = request.query_params.get('actor_id')
        communication_type = request.query_params.get('communication_type')
        keyword = request.query_params.get('search', '')
        start_date = parse_datetime(request.query_params.get('start_date')) if request.query_params.get('start_date') else None
        end_date = parse_datetime(request.query_params.get('end_date')) if request.query_params.get('end_date') else None
        communications = get_communication_timeline(
            school_id=school_id,
            actor_id=actor_id,
            communication_type=communication_type,
            keyword=keyword,
            start_date=start_date,
            end_date=end_date,
        )
        return Response(CommunicationLogSerializer(communications, many=True).data)

    def post(self, request, *args, **kwargs):
        serializer = CommunicationLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school = get_object_or_404(School, pk=payload['school_id'])
        _ensure_school_access(request, school)
        try:
            communication, follow_up = log_communication(
                school_id=school.id,
                actor_id=request.user.id,
                communication_type=payload['communication_type'],
                direction=payload.get('direction', 'OUTBOUND'),
                participants=payload.get('participants') or [],
                subject=payload.get('subject', ''),
                content=payload['content'],
                attachments=payload.get('attachments') or [],
                occurred_at=payload.get('occurred_at'),
                follow_up_required=payload.get('follow_up_required', False),
                follow_up_due_at=payload.get('follow_up_due_at'),
                follow_up_title=payload.get('follow_up_title', ''),
                follow_up_description=payload.get('follow_up_description', ''),
                follow_up_assigned_to_id=payload.get('follow_up_assigned_to_id'),
                lead_id=payload.get('lead_id'),
                onboarding_progress_id=payload.get('onboarding_progress_id'),
                task_id=payload.get('task_id'),
                opportunity_id=payload.get('opportunity_id'),
                metadata=payload.get('metadata') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(
            {
                'communication': CommunicationLogSerializer(communication).data,
                'follow_up': FollowUpSerializer(follow_up).data if follow_up else None,
            },
            status=status.HTTP_201_CREATED,
        )


class NotificationTemplateListView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        _ensure_platform_staff(request)
        templates = ensure_default_notification_templates()
        return Response(NotificationTemplateSerializer(templates, many=True).data)


class NotificationPreviewView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationPreviewSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            preview = preview_notification_template(
                template_key=serializer.validated_data['template_key'],
                variables=serializer.validated_data.get('variables') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(preview)


class NotificationListView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationListQuerySerializer

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school_id = payload.get('school_id')
        if school_id:
            school = get_object_or_404(School, pk=school_id)
            _ensure_school_access(request, school)
        recipient_id = payload.get('recipient_id') if _is_platform_staff(request.user) else request.user.id
        notifications = get_notification_records(
            school_id=school_id,
            recipient_id=recipient_id,
            channel=payload.get('channel'),
            status=payload.get('status'),
            unread_only=payload.get('unread_only', False),
        )
        return Response(NotificationRecordSerializer(notifications, many=True).data)


class NotificationSendView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSendSerializer

    def post(self, request, *args, **kwargs):
        from apps.users.models import User

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school = get_object_or_404(School, pk=payload['school_id'])
        _ensure_school_access(request, school)
        recipient = get_object_or_404(User, pk=payload['recipient_id'])
        lead = get_object_or_404(Lead, pk=payload['lead_id'], school=school) if payload.get('lead_id') else None
        onboarding_progress = get_object_or_404(OnboardingProgress, pk=payload['onboarding_progress_id'], school=school) if payload.get('onboarding_progress_id') else None
        task = get_object_or_404(SchoolTask, pk=payload['task_id'], school=school) if payload.get('task_id') else None
        follow_up = get_object_or_404(FollowUp, pk=payload['follow_up_id'], school=school) if payload.get('follow_up_id') else None
        opportunity = get_object_or_404(UpsellOpportunity, pk=payload['opportunity_id'], school=school) if payload.get('opportunity_id') else None
        try:
            notifications = send_notification(
                school=school,
                recipient=recipient,
                template_key=payload['template_key'],
                variables=payload.get('variables') or {},
                channels=payload.get('channels') or None,
                subject_override=payload.get('subject_override', ''),
                body_override=payload.get('body_override', ''),
                schedule_for=payload.get('schedule_for'),
                lead=lead,
                onboarding_progress=onboarding_progress,
                task=task,
                follow_up=follow_up,
                opportunity=opportunity,
                metadata=payload.get('metadata') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(NotificationRecordSerializer(notifications, many=True).data, status=status.HTTP_201_CREATED)


class FollowUpListCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = FollowUpListQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school_id = payload.get('school_id')
        if school_id:
            school = get_object_or_404(School, pk=school_id)
            _ensure_school_access(request, school)
        elif not _is_platform_staff(request.user):
            school_id = request.user.school_id
        assigned_to_id = payload.get('assigned_to_id') if _is_platform_staff(request.user) else request.user.id if request.query_params.get('assigned_to_me') == 'true' else payload.get('assigned_to_id')
        follow_ups = get_follow_up_list(
            school_id=school_id,
            assigned_to_id=assigned_to_id,
            status=payload.get('status'),
            due_today=payload.get('due_today', False),
            overdue=payload.get('overdue', False),
        )
        return Response(FollowUpSerializer(follow_ups, many=True).data)

    def post(self, request, *args, **kwargs):
        from apps.users.models import User

        serializer = FollowUpCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        school = get_object_or_404(School, pk=payload['school_id'])
        _ensure_school_access(request, school)
        assigned_to = get_object_or_404(User, pk=payload['assigned_to_id']) if payload.get('assigned_to_id') else None
        lead = get_object_or_404(Lead, pk=payload['lead_id'], school=school) if payload.get('lead_id') else None
        onboarding_progress = get_object_or_404(OnboardingProgress, pk=payload['onboarding_progress_id'], school=school) if payload.get('onboarding_progress_id') else None
        task = get_object_or_404(SchoolTask, pk=payload['task_id'], school=school) if payload.get('task_id') else None
        communication_log = get_object_or_404(CommunicationLog, pk=payload['communication_log_id'], school=school) if payload.get('communication_log_id') else None
        opportunity = get_object_or_404(UpsellOpportunity, pk=payload['opportunity_id'], school=school) if payload.get('opportunity_id') else None
        try:
            follow_up = create_follow_up(
                school=school,
                created_by=request.user,
                title=payload['title'],
                description=payload.get('description', ''),
                due_at=payload['due_at'],
                assigned_to=assigned_to,
                lead=lead,
                onboarding_progress=onboarding_progress,
                task=task,
                communication_log=communication_log,
                opportunity=opportunity,
                follow_up_type=payload.get('follow_up_type', 'CUSTOM'),
                recurrence=payload.get('recurrence', 'NONE'),
                metadata=payload.get('metadata') or {},
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(FollowUpSerializer(follow_up).data, status=status.HTTP_201_CREATED)


class TodayFollowUpListView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        follow_ups = get_todays_follow_ups(staff_id=request.user.id)
        visible_follow_ups = [follow_up for follow_up in follow_ups if _is_platform_staff(request.user) or follow_up.school_id == request.user.school_id]
        return Response(FollowUpSerializer(visible_follow_ups, many=True).data)


class FollowUpSnoozeView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FollowUpSnoozeSerializer

    def post(self, request, follow_up_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_up = get_object_or_404(FollowUp.objects.select_related('school'), pk=follow_up_id)
        _ensure_school_access(request, follow_up.school)
        try:
            updated_follow_up = snooze_follow_up(follow_up_id=follow_up_id, actor_id=request.user.id, days=serializer.validated_data['days'])
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(FollowUpSerializer(updated_follow_up).data)


class FollowUpCompleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FollowUpCompleteSerializer

    def post(self, request, follow_up_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_up = get_object_or_404(FollowUp.objects.select_related('school'), pk=follow_up_id)
        _ensure_school_access(request, follow_up.school)
        try:
            updated_follow_up = complete_follow_up(
                follow_up_id=follow_up_id,
                actor_id=request.user.id,
                notes=serializer.validated_data.get('notes', ''),
            )
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(FollowUpSerializer(updated_follow_up).data)


class ProcessDueFollowUpsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        _ensure_platform_staff(request)
        try:
            results = process_due_follow_ups(actor_id=request.user.id)
        except DjangoValidationError as exc:
            raise _service_error(exc)
        return Response(results)