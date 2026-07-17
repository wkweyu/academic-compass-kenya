import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.schools.services import log_activity

from .models import User
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


logger = logging.getLogger(__name__)


def _authorize_manager(user):
    try:
        return AccountService.ensure_manager_access(user)
    except PermissionError as exc:
        raise PermissionDenied(str(exc))

class UserResetPasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        _authorize_manager(request.user)

        try:
            success = AccountService.reset_password(user_id=user_id, caller=request.user, request=request)
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
        _authorize_manager(request.user)

        try:
            success = AccountService.resend_credentials(user_id=user_id, caller=request.user, request=request)
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
        try:
            return AccountService.get_login_history_queryset(requester=self.request.user, target_user_id=user_id)
        except User.DoesNotExist:
            raise ValidationError({'detail': 'User not found.'})
        except PermissionError as exc:
            raise PermissionDenied(str(exc))


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        role = self.request.query_params.get('role')
        return AccountService.list_users_for_caller(caller=self.request.user, role=role)

    def create(self, request, *args, **kwargs):
        _authorize_manager(request.user)
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            user = AccountService.create_account(
                caller=request.user,
                email=payload['email'],
                role=payload['role'],
                first_name=payload.get('first_name'),
                last_name=payload.get('last_name'),
                password=payload.get('password'),
                request=request,
            )
        except (ValueError, PermissionError) as e:
            raise ValidationError({'detail': str(e)})

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class EnableLoginView(generics.GenericAPIView):
    serializer_class = EnableLoginSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _provision_from_payload(self, request, payload):
        try:
            user = AccountService.enable_login(
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
            user = AccountService.change_role(
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
        _authorize_manager(request.user)
        result = AccountService.repair_platform_auth_links_and_roles()
        return Response({'success': True, **result}, status=status.HTTP_200_OK)


class UserDeleteView(generics.DestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = 'user_id'

    def destroy(self, request, *args, **kwargs):
        _authorize_manager(request.user)
        user_id = kwargs.get(self.lookup_url_kwarg)
        try:
            AccountService.delete_user(user_id=user_id, caller=request.user)
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response({'detail': 'User deleted successfully.'}, status=status.HTTP_200_OK)

class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user

        AccountService.touch_login_history(user=user, request=self.request)

        return user


class CompleteFirstLoginView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        AccountService.complete_first_login(user=request.user, request=request)

        return Response({'success': True}, status=status.HTTP_200_OK)


class UserRoleChangePreviewView(generics.GenericAPIView):
    serializer_class = UserRoleChangePreviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            impact = AccountService.preview_role_change(
                caller=request.user,
                user_id=user_id,
                new_role=serializer.validated_data['new_role'],
            )
        except PermissionError as exc:
            raise PermissionDenied(str(exc))
        except User.DoesNotExist:
            raise ValidationError({'detail': 'User not found.'})
        except DjangoValidationError as exc:
            raise ValidationError(getattr(exc, 'message_dict', str(exc)))
        return Response(impact)


class UserRoleChangeView(generics.GenericAPIView):
    serializer_class = UserRoleChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        target_staff_ids = {
            'lead_target_staff_id': payload.get('lead_target_staff_id'),
            'onboarding_target_staff_id': payload.get('onboarding_target_staff_id'),
            'school_target_staff_id': payload.get('school_target_staff_id'),
        }
        try:
            staff, result = AccountService.apply_role_change(
                caller=request.user,
                user_id=user_id,
                new_role=payload['new_role'],
                strategy=payload['strategy'],
                keep_lead_ids=payload.get('keep_lead_ids') or [],
                keep_school_ids=payload.get('keep_school_ids') or [],
                target_staff_ids=target_staff_ids,
                notes=payload.get('notes', ''),
            )
        except PermissionError as exc:
            raise PermissionDenied(str(exc))
        except User.DoesNotExist:
            raise ValidationError({'detail': 'User not found.'})
        except DjangoValidationError as exc:
            raise ValidationError(getattr(exc, 'message_dict', str(exc)))
        return Response({'user': UserSerializer(staff).data, 'role_change': result})
