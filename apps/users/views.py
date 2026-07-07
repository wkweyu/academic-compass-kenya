from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import make_password
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.schools.services import change_staff_role, get_role_change_impact, normalize_role
from apps.students.models import Student
from apps.teachers.models import Teacher

from .models import User
from .serializers import (
    EnableLoginSerializer,
    UserCreateSerializer,
    UserRoleChangePreviewSerializer,
    UserRoleChangeSerializer,
    UserSerializer,
)


PLATFORM_STAFF_ROLES = {'staff', 'sales_rep', 'onboarding_specialist', 'account_manager', 'marketer', 'manager', 'platform_admin', 'support'}
SYNCABLE_PLATFORM_ROLES = ('platform_admin', 'support', 'account_manager', 'marketer')

def _is_platform_staff(user):
    role = normalize_role(getattr(user, 'role', '')).lower()
    return bool(user.is_superuser or user.is_staff or (not getattr(user, 'school_id', None) and role in PLATFORM_STAFF_ROLES))

def _ensure_manager_access(user):
    if _is_platform_staff(user):
        return user
    raise PermissionDenied('Only platform administrators or managers can perform user management.')


def _is_school_admin(user, school):
    if not school:
        return False
    if user.is_superuser or user.is_staff:
        return True
    normalized_role = normalize_role(getattr(user, 'role', '')).lower()
    return bool(getattr(user, 'school_id', None) == getattr(school, 'id', None) and normalized_role in {'admin', 'schooladmin', 'school_admin', 'principal', 'headteacher'})


def _resolve_entity(entity_type, entity_id):
    normalized_type = str(entity_type or '').strip().lower()
    if normalized_type in {'teacher', 'teachers'}:
        return Teacher.objects.filter(pk=entity_id).first()
    if normalized_type in {'student', 'students'}:
        return Student.objects.filter(pk=entity_id).first()
    return None


def _build_unique_username(email, exclude_user=None):
    username_base = email.split('@')[0].replace('.', '').replace('_', '') or 'user'
    username = username_base
    suffix = 1
    queryset = User.objects.filter(username=username)
    if exclude_user is not None:
        queryset = queryset.exclude(pk=exclude_user.pk)
    while queryset.exists():
        suffix += 1
        username = f"{username_base}{suffix}"
        queryset = User.objects.filter(username=username)
        if exclude_user is not None:
            queryset = queryset.exclude(pk=exclude_user.pk)
    return username


def _repair_platform_auth_links_and_roles():
    if connection.vendor != 'postgresql':
        return {'linked_users': 0, 'role_grants': 0}

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'auth' AND table_name = 'users'
            )
            """
        )
        has_auth_users = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'user_roles'
            )
            """
        )
        has_user_roles = cursor.fetchone()[0]

        if not has_auth_users or not has_user_roles:
            return {'linked_users': 0, 'role_grants': 0}

        cursor.execute(
            """
            UPDATE public.users AS pu
            SET auth_user_id = au.id
            FROM auth.users AS au
            WHERE pu.school_id IS NULL
              AND pu.auth_user_id IS NULL
              AND LOWER(COALESCE(pu.email, '')) = LOWER(COALESCE(au.email, ''))
              AND pu.role = ANY(%s)
            """,
            [list(SYNCABLE_PLATFORM_ROLES)],
        )
        linked_users = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO public.user_roles (user_id, role)
            SELECT pu.auth_user_id, pu.role::public.app_role
            FROM public.users AS pu
            WHERE pu.school_id IS NULL
              AND pu.auth_user_id IS NOT NULL
              AND pu.role = ANY(%s)
            ON CONFLICT (user_id, role) DO NOTHING
            """,
            [list(SYNCABLE_PLATFORM_ROLES)],
        )
        role_grants = cursor.rowcount

    return {'linked_users': linked_users, 'role_grants': role_grants}

class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.filter(school_id__isnull=True).order_by('first_name', 'last_name', 'email')
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def create(self, request, *args, **kwargs):
        _ensure_manager_access(request.user)
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        email = payload['email'].strip().lower()
        first_name = payload.get('first_name', '').strip()
        last_name = payload.get('last_name', '').strip()
        role = normalize_role(payload.get('role', 'support'))
        password = payload.get('password') or 'ChangeMe123!'

        username_base = email.split('@')[0]
        username = username_base
        suffix = 1
        # Check both username and email for collisions
        if User.objects.filter(email=email).exists():
            raise ValidationError({'email': 'A user with this email already exists.'})

        # Check username collisions
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{username_base}{suffix}"

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_staff=True,
            is_active=True,
        )

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class EnableLoginView(generics.GenericAPIView):
    serializer_class = EnableLoginSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        entity = _resolve_entity(payload['entity_type'], payload['entity_id'])
        if entity is None:
            raise ValidationError({'entity_id': 'The selected entity could not be found.'})

        school = getattr(entity, 'school', None)
        if school is None:
            raise ValidationError({'detail': 'The selected entity does not belong to a school.'})

        if not _is_school_admin(request.user, school):
            raise PermissionDenied('Only school administrators for this school can enable login for this entity.')

        email = payload['email'].strip().lower()
        role = normalize_role(payload.get('role', 'staff'))
        login_enabled = payload.get('login_enabled', True)
        send_invite = payload.get('send_invite', False)
        expires_at = payload.get('expires_at')

        if login_enabled and not send_invite:
            status = 'ACTIVE'
        elif login_enabled and send_invite:
            status = 'INVITED'
        else:
            status = 'DISABLED'

        existing_user = User.objects.filter(entity_type=str(entity.__class__.__name__).lower(), entity_id=entity.id).first()
        if existing_user is None:
            existing_user = User.objects.filter(email__iexact=email).first()

        if existing_user is None:
            username = _build_unique_username(email)
            user = User.objects.create_user(
                username=username,
                email=email,
                password=make_password('ChangeMe123!'),
                first_name=getattr(entity, 'first_name', '').strip() or email.split('@')[0],
                last_name=getattr(entity, 'last_name', '').strip(),
                role=role,
                school=school,
                entity_type=str(entity.__class__.__name__).lower(),
                entity_id=entity.id,
                status=status,
                login_enabled=login_enabled,
                expires_at=expires_at,
                is_active=login_enabled and status in {'ACTIVE', 'INVITED', 'PENDING_EMAIL_VERIFICATION'},
            )
        else:
            existing_user.username = _build_unique_username(email, exclude_user=existing_user)
            existing_user.email = email
            existing_user.first_name = getattr(entity, 'first_name', '').strip() or existing_user.first_name
            existing_user.last_name = getattr(entity, 'last_name', '').strip() or existing_user.last_name
            existing_user.role = role
            existing_user.school = school
            existing_user.entity_type = str(entity.__class__.__name__).lower()
            existing_user.entity_id = entity.id
            existing_user.status = status
            existing_user.login_enabled = login_enabled
            existing_user.expires_at = expires_at
            existing_user.is_active = login_enabled and status in {'ACTIVE', 'INVITED', 'PENDING_EMAIL_VERIFICATION'}
            existing_user.save()
            user = existing_user

        return Response(
            {
                'id': user.id,
                'email': user.email,
                'entity_type': user.entity_type,
                'entity_id': user.entity_id,
                'role': user.role,
                'status': user.status,
                'login_enabled': user.login_enabled,
            },
            status=status.HTTP_201_CREATED,
        )


class PlatformUserRepairView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        _ensure_manager_access(request.user)
        result = _repair_platform_auth_links_and_roles()
        return Response({'success': True, **result}, status=status.HTTP_200_OK)


class UserDeleteView(generics.DestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = 'user_id'

    def destroy(self, request, *args, **kwargs):
        _ensure_manager_access(request.user)
        user = self.get_object()
        if user.id == request.user.id:
            raise ValidationError({'detail': 'You cannot delete your own account.'})

        with transaction.atomic():
            # If platform staff, check for portfolio assignments
            if not user.school_id and user.auth_user_id:
                # We need to unassign or reassign schools in their portfolio
                from django.db import connection
                with connection.cursor() as cursor:
                    # Use standard check if table exists
                    cursor.execute(
                        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_portfolio_assignments')"
                    )
                    if cursor.fetchone()[0]:
                        cursor.execute(
                            'DELETE FROM school_portfolio_assignments WHERE owner_user_id = %s',
                            [user.auth_user_id]
                        )

            user.delete()
        return Response({'detail': 'User deleted successfully.'}, status=status.HTTP_200_OK)

class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserRoleChangePreviewView(generics.GenericAPIView):
    serializer_class = UserRoleChangePreviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        _ensure_manager_access(request.user)
        serializer = self.get_serializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        staff = get_object_or_404(User, pk=user_id)
        try:
            impact = get_role_change_impact(staff_id=staff.id, new_role=serializer.validated_data['new_role'])
        except DjangoValidationError as exc:
            raise ValidationError(getattr(exc, 'message_dict', str(exc)))
        return Response(impact)


class UserRoleChangeView(generics.GenericAPIView):
    serializer_class = UserRoleChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        _ensure_manager_access(request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = get_object_or_404(User, pk=user_id)
        payload = serializer.validated_data
        target_staff_ids = {
            'lead_target_staff_id': payload.get('lead_target_staff_id'),
            'onboarding_target_staff_id': payload.get('onboarding_target_staff_id'),
            'school_target_staff_id': payload.get('school_target_staff_id'),
        }
        try:
            result = change_staff_role(
                staff_id=staff.id,
                initiated_by_id=request.user.id,
                new_role=payload['new_role'],
                strategy=payload['strategy'],
                keep_lead_ids=payload.get('keep_lead_ids') or [],
                keep_school_ids=payload.get('keep_school_ids') or [],
                target_staff_ids=target_staff_ids,
                notes=payload.get('notes', ''),
            )
        except DjangoValidationError as exc:
            raise ValidationError(getattr(exc, 'message_dict', str(exc)))
        staff.refresh_from_db()
        return Response({'user': UserSerializer(staff).data, 'role_change': result})
