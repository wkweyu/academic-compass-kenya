from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.schools.services import change_staff_role, get_role_change_impact, normalize_role

from .models import User
from .serializers import UserRoleChangePreviewSerializer, UserRoleChangeSerializer, UserSerializer


def _ensure_manager_access(user):
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return user
    if normalize_role(getattr(user, 'role', '')) == 'manager':
        return user
    raise PermissionDenied('Only managers can perform role changes.')

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

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
