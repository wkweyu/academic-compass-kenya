from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.schools.services import change_staff_role, get_role_change_impact, normalize_role

from .models import User
from .serializers import UserCreateSerializer, UserRoleChangePreviewSerializer, UserRoleChangeSerializer, UserSerializer


def _ensure_manager_access(user):
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return user
    # Handle platform_admin and manager as authorized roles for user management
    role = normalize_role(getattr(user, 'role', '')).lower()
    if role in ['manager', 'platform_admin']:
        return user
    raise PermissionDenied('Only platform administrators or managers can perform user management.')

class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.all().order_by('first_name', 'last_name', 'email')
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
        if User.objects.filter(email=email).exists():
            raise ValidationError({'email': 'A user with this email already exists.'})

        first_name = payload.get('first_name', '').strip()
        last_name = payload.get('last_name', '').strip()
        role = normalize_role(payload.get('role', 'support'))
        password = payload.get('password') or 'ChangeMe123!'

        username_base = email.split('@')[0]
        username = username_base
        suffix = 1
        # Check both username and email for collisions
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
