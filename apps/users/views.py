import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.schools.services import change_staff_role, get_role_change_impact, log_activity, normalize_role

from .models import LoginHistory, User
from .serializers import (
    EnableLoginSerializer,
    LoginHistorySerializer,
    UserAssignRoleSerializer,
    UserCreateSerializer,
    UserRoleChangePreviewSerializer,
    UserRoleChangeSerializer,
    UserSerializer,
)
from .services import AccountService


PLATFORM_STAFF_ROLES = {'staff', 'sales_rep', 'onboarding_specialist', 'account_manager', 'marketer', 'manager', 'platform_admin', 'support'}
SYNCABLE_PLATFORM_ROLES = ('platform_admin', 'support', 'account_manager', 'marketer')
logger = logging.getLogger(__name__)

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

class UserResetPasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        user = get_object_or_404(User, pk=user_id)

        # Check permissions - only platform staff or school admins can reset passwords
        _ensure_manager_access(request.user)

        try:
            success = AccountService.send_password_reset(user_id=user.id, caller=request.user, request=request)
            if success:
                return Response({'detail': 'Password reset email sent successfully.'}, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'Failed to send password reset email.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Error in UserResetPasswordView")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ResendLoginDetailsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        user = get_object_or_404(User, pk=user_id)
        _ensure_manager_access(request.user)

        try:
            success = AccountService.resend_login_details(user_id=user.id, caller=request.user, request=request)
            if success:
                return Response({'detail': 'Login details resent successfully.'}, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'Failed to resend login details.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Error in ResendLoginDetailsView")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LoginHistoryListView(generics.ListAPIView):
    serializer_class = LoginHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        user = get_object_or_404(User, pk=user_id)

        # Ensure the caller has access to this user's history
        # (Simplified: managers or the user themselves)
        if self.request.user.id != user.id:
            _ensure_manager_access(self.request.user)

        return LoginHistory.objects.filter(user=user)


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if _is_platform_staff(self.request.user):
            queryset = User.objects.filter(school_id__isnull=True)
        elif getattr(self.request.user, 'school_id', None):
            queryset = User.objects.filter(school_id=self.request.user.school_id)
        else:
            queryset = User.objects.none()

        queryset = queryset.order_by('first_name', 'last_name', 'email')
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def create(self, request, *args, **kwargs):
        _ensure_manager_access(request.user)
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            user = AccountService.provision_account(
                caller=request.user,
                email=payload['email'],
                role=payload['role'],
                first_name=payload.get('first_name'),
                last_name=payload.get('last_name'),
                password=payload.get('password'),
                login_enabled=True,
            )
        except (ValueError, PermissionError) as e:
            raise ValidationError({'detail': str(e)})

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class EnableLoginView(generics.GenericAPIView):
    serializer_class = EnableLoginSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _provision_from_payload(self, request, payload):
        try:
            user = AccountService.provision_account(
                caller=request.user,
                email=payload['email'],
                role=payload.get('role', 'staff'),
                entity_type=payload.get('entity_type'),
                entity_id=payload.get('entity_id'),
                login_enabled=payload.get('login_enabled', True),
                send_invite=payload.get('send_invite', False),
                expires_at=payload.get('expires_at'),
                request=request,
            )
        except (ValueError, PermissionError) as e:
            if str(e) == AccountService.ENTITY_ALREADY_LINKED_ERROR:
                return Response({'detail': str(e)}, status=status.HTTP_409_CONFLICT)
            logger.error(f"Account provisioning failed: {str(e)}")
            raise ValidationError({'detail': str(e)})
        except Exception:
            logger.exception("Unexpected error during account provisioning")
            raise ValidationError({'detail': 'An unexpected error occurred during account provisioning.'})

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

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        return self._provision_from_payload(request, payload)


class EntityEnableLoginView(EnableLoginView):
    serializer_class = EnableLoginSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        payload_data = request.data.copy()
        payload_data['entity_type'] = kwargs['entity_type']
        payload_data['entity_id'] = kwargs['entity_id']

        serializer = self.get_serializer(data=payload_data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        return self._provision_from_payload(request, payload)


class DisableLoginView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        try:
            user = AccountService.disable_login(user_id=user_id, caller=request.user)
        except User.DoesNotExist:
            raise ValidationError({'detail': 'User not found.'})
        except (ValueError, PermissionError) as e:
            if str(e) == AccountService.LAST_ADMIN_DISABLE_ERROR:
                return Response({'detail': str(e)}, status=status.HTTP_409_CONFLICT)
            raise ValidationError({'detail': str(e)})

        return Response(
            {
                'id': user.id,
                'email': user.email,
                'status': user.status,
                'login_enabled': user.login_enabled,
            },
            status=status.HTTP_200_OK,
        )


class UserAssignRoleView(generics.GenericAPIView):
    serializer_class = UserAssignRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = AccountService.assign_role(
                user_id=user_id,
                new_role=serializer.validated_data['role'],
                caller=request.user,
                request=request,
            )
        except (ValueError, PermissionError) as e:
            if str(e) == AccountService.USER_NOT_FOUND_ERROR:
                return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)
            raise ValidationError({'detail': str(e)})

        return Response(
            {
                'id': user.id,
                'email': user.email,
                'role': user.role,
            },
            status=status.HTTP_200_OK,
        )


class EntityDisableLoginView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        entity_type = kwargs['entity_type']
        entity_id = kwargs['entity_id']
        try:
            user = AccountService.disable_login_for_entity(entity_type=entity_type, entity_id=entity_id, caller=request.user)
        except (ValueError, PermissionError) as e:
            if str(e) in {
                AccountService.LAST_ADMIN_DISABLE_ERROR,
                AccountService.LINKED_ACCOUNT_NOT_FOUND_ERROR,
            }:
                code = status.HTTP_409_CONFLICT if str(e) == AccountService.LAST_ADMIN_DISABLE_ERROR else status.HTTP_404_NOT_FOUND
                return Response({'detail': str(e)}, status=code)
            raise ValidationError({'detail': str(e)})

        return Response(
            {
                'id': user.id,
                'email': user.email,
                'status': user.status,
                'login_enabled': user.login_enabled,
            },
            status=status.HTTP_200_OK,
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
        if user.school_id and AccountService._is_last_school_admin(user):
            raise ValidationError({'detail': 'Cannot delete the last active school administrator for this school.'})

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
        user = self.request.user

        # Record Login History if this is a "fresh" hit in this session
        # We can use a session variable or just check last login history entry
        last_login = LoginHistory.objects.filter(user=user).first()
        now = timezone.now()

        # If no login history or last login was more than 30 mins ago, record new one
        # (This is a simple heuristic to avoid duplicate logs on page refreshes)
        if not last_login or (now - last_login.login_time).total_seconds() > 1800:
             ip_address = None
             x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
             if x_forwarded_for:
                 ip_address = x_forwarded_for.split(',')[0]
             else:
                 ip_address = self.request.META.get('REMOTE_ADDR')

             LoginHistory.objects.create(
                 user=user,
                 ip_address=ip_address,
                 user_agent=self.request.META.get('HTTP_USER_AGENT'),
                 successful=True
             )

             # Also update User.last_login
             user.last_login = now
             user.save(update_fields=['last_login'])

        return user


class CompleteFirstLoginView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        user.force_password_change = False
        if user.status == 'INVITED':
            user.status = 'ACTIVE'
        user.save(update_fields=['force_password_change', 'status'])

        # Log Audit
        log_activity(
            school=user.school,
            actor=user,
            action="first_login_completed",
            description=f"User {user.email} completed first login password change.",
            request=request
        )

        return Response({'success': True}, status=status.HTTP_200_OK)


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
