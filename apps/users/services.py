import logging
import secrets
import string
from datetime import datetime
from typing import Optional, Tuple, Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.schools.services import change_staff_role, get_role_change_impact, log_activity, normalize_role
from apps.students.models import Student
from apps.teachers.models import Teacher
from .models import AccountStatus, LinkedEntityType, LoginHistory
from .notification_service import NotificationService
from .supabase_auth_service import SupabaseAuthService

logger = logging.getLogger(__name__)
User = get_user_model()


class AuditAction:
    ENABLE_LOGIN = 'ENABLE_LOGIN'
    DISABLE_LOGIN = 'DISABLE_LOGIN'
    ROLE_CHANGE = 'ROLE_CHANGE'
    PASSWORD_RESET = 'PASSWORD_RESET'
    INVITE_SENT = 'INVITE_SENT'
    ACCOUNT_EXPIRED = 'ACCOUNT_EXPIRED'
    ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED'

class AccountService:
    ENTITY_ALREADY_LINKED_ERROR = 'Entity already has a linked user account.'
    LAST_ADMIN_DISABLE_ERROR = 'Cannot disable the last administrator for this school.'
    LINKED_ACCOUNT_NOT_FOUND_ERROR = 'No linked user account was found for this entity.'
    USER_NOT_FOUND_ERROR = 'User not found.'
    SELF_DELETE_ERROR = 'You cannot delete your own account.'
    LAST_ADMIN_DELETE_ERROR = 'Cannot delete the last active school administrator for this school.'

    PLATFORM_STAFF_ROLES = {
        'staff',
        'sales_rep',
        'onboarding_specialist',
        'account_manager',
        'marketer',
        'manager',
        'platform_admin',
        'support',
    }

    ADMIN_ROLES = {'admin', 'schooladmin', 'school_admin', 'principal', 'headteacher'}

    SYNCABLE_PLATFORM_ROLES = ('platform_admin', 'support', 'account_manager', 'marketer')

    @staticmethod
    def is_platform_staff(user: User) -> bool:
        caller_role = normalize_role(getattr(user, 'role', '')).lower()
        return bool(
            user.is_superuser
            or user.is_staff
            or (not getattr(user, 'school_id', None) and caller_role in AccountService.PLATFORM_STAFF_ROLES)
        )

    @classmethod
    def ensure_manager_access(cls, user: User) -> User:
        if cls.is_platform_staff(user):
            return user
        raise PermissionError('Only platform administrators or managers can perform user management.')

    @staticmethod
    def _generate_temp_password(length: int = 14) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    @staticmethod
    def _resolve_entity(entity_type: str, entity_id: int) -> Any:
        normalized_type = str(entity_type or '').strip().lower()
        if normalized_type in {LinkedEntityType.TEACHER, 'teachers', LinkedEntityType.STAFF}:
            # Support both teacher and staff mapping to Teacher model if that is the source of truth
            return Teacher.objects.filter(pk=entity_id).first()
        if normalized_type in {LinkedEntityType.STUDENT, 'students'}:
            return Student.objects.filter(pk=entity_id).first()
        # Add other entities as they are implemented (e.g., Parent)
        return None

    @staticmethod
    def _build_unique_username(email: str, exclude_user_id: Optional[int] = None) -> str:
        username_base = email.split('@')[0].replace('.', '').replace('_', '') or 'user'
        username = username_base
        suffix = 1

        while True:
            qs = User.objects.filter(username=username)
            if exclude_user_id:
                qs = qs.exclude(pk=exclude_user_id)

            if not qs.exists():
                return username

            suffix += 1
            username = f"{username_base}{suffix}"

    @classmethod
    def enable_login(
        cls,
        caller: User,
        email: str,
        role: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        login_enabled: bool = True,
        send_invite: bool = False,
        expires_at: Optional[datetime] = None,
        password: Optional[str] = None,
        request: Any = None,
    ) -> User:
        email = email.strip().lower()
        role = normalize_role(role)

        # If enabling login or resending invite, generate temp password if not provided
        force_password_change = False
        if login_enabled and (send_invite or not password):
            if not password:
                password = cls._generate_temp_password()
            force_password_change = True

        logger.info(f"Provisioning account: email={email}, role={role}, entity_type={entity_type}, "
                    f"entity_id={entity_id}, login_enabled={login_enabled}, send_invite={send_invite}")

        with transaction.atomic():
            # 1. Resolve entity and school
            entity = None
            school = None
            is_platform_user = True

            if entity_type and entity_id:
                entity = cls._resolve_entity(entity_type, entity_id)
                if not entity:
                    raise ValueError(f"Entity {entity_type} with ID {entity_id} not found.")
                school = getattr(entity, 'school', None)
                if not school:
                    raise ValueError("The selected entity does not belong to a school.")
                is_platform_user = False

                # Auto-fill names from entity if not provided
                first_name = first_name or getattr(entity, 'first_name', '')
                last_name = last_name or getattr(entity, 'last_name', '')

            # 2. Permission and Tenant Validation
            cls._validate_permissions(caller, school, role)

            # 3. Duplicate Detection / Idempotency
            user = cls._find_existing_user(email, entity_type, entity_id)

            # 4. Status determination
            if not login_enabled:
                status = AccountStatus.NOT_ENABLED
            elif send_invite:
                status = AccountStatus.INVITED
            else:
                status = AccountStatus.ACTIVE

            # 5. Create or Update Local User
            if not user:
                # Check for email collision with different entity
                if User.objects.filter(email__iexact=email).exists():
                    raise ValueError(f"A user with email {email} already exists.")

                username = cls._build_unique_username(email)
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    role=role,
                    school=school,
                    entity_type=entity_type or '',
                    entity_id=entity_id,
                    first_name=first_name or '',
                    last_name=last_name or '',
                    status=status,
                    login_enabled=login_enabled,
                    force_password_change=force_password_change,
                    expires_at=expires_at,
                    is_active=login_enabled and status in {
                        AccountStatus.ACTIVE,
                        AccountStatus.INVITED,
                        AccountStatus.PENDING_EMAIL_VERIFICATION,
                    },
                    is_staff=is_platform_user # Platform users are Django staff by default in this system
                )
                if password:
                    user.set_password(password)
                    user.save(update_fields=['password'])
            else:
                user.email = email
                user.role = role
                user.school = school
                user.entity_type = entity_type or user.entity_type
                user.entity_id = entity_id or user.entity_id
                user.first_name = first_name or user.first_name
                user.last_name = last_name or user.last_name
                user.status = status
                user.login_enabled = login_enabled
                user.force_password_change = force_password_change or user.force_password_change
                user.expires_at = expires_at
                user.is_active = login_enabled and status in {
                    AccountStatus.ACTIVE,
                    AccountStatus.INVITED,
                    AccountStatus.PENDING_EMAIL_VERIFICATION,
                }
                # Preserve is_staff status for existing users or update if becoming platform user
                if is_platform_user:
                    user.is_staff = True
                user.save()

        # 6. Supabase Sync (outside transaction)
        # We always want to sync the password if we generated one
        cls._sync_supabase_user(user, password, send_invite=False) # We handle invite via our branded email

        # 7. Audit Logging
        action = AuditAction.ENABLE_LOGIN
        if send_invite:
            action = AuditAction.INVITE_SENT
        cls._log_account_action(user, caller, action, school or user.school, request=request)

        # 8. Notification - Branded Welcome Email
        if send_invite and login_enabled:
            NotificationService.send_welcome_email(user=user, school=school or user.school, password=password)

        return user

    @classmethod
    def create_account(
        cls,
        *,
        caller: User,
        email: str,
        role: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        password: Optional[str] = None,
        request: Any = None,
    ) -> User:
        return cls.enable_login(
            caller=caller,
            email=email,
            role=role,
            first_name=first_name,
            last_name=last_name,
            password=password,
            login_enabled=True,
            send_invite=False,
            request=request,
        )

    @classmethod
    def provision_account(cls, *args, **kwargs) -> User:
        # Backward-compatible wrapper for existing callers.
        return cls.enable_login(*args, **kwargs)

    @classmethod
    def reset_password(cls, user_id: int, caller: User, request: Any = None) -> bool:
        user = User.objects.get(pk=user_id)

        # Permission check
        cls._validate_permissions(caller, user.school, user.role)

        if not user.auth_user_id:
            logger.warning(f"Cannot send reset email for {user.email}: No Supabase auth_user_id found.")
            return False

        # For our branded flow, we generate a new password and email it.
        temp_password = cls._generate_temp_password()

        try:
            # Update Supabase
            updated = SupabaseAuthService.update_user(
                auth_user_id=user.auth_user_id,
                email=user.email,
                password=temp_password,
                email_confirm=True,
            )
            if not updated:
                return False

            # Update Django
            user.force_password_change = True
            user.status = AccountStatus.INVITED
            user.save(update_fields=['force_password_change', 'status'])

            # Send Email
            NotificationService.send_password_reset(user=user, school=user.school, password=temp_password)

            # Audit
            cls._log_account_action(user, caller, AuditAction.PASSWORD_RESET, user.school, request=request)

            return True
        except Exception as e:
            logger.error(f"Failed to reset password for {user.email}: {e}")
            return False

    @classmethod
    def send_password_reset(cls, *args, **kwargs) -> bool:
        # Backward-compatible wrapper for existing callers.
        return cls.reset_password(*args, **kwargs)

    @classmethod
    def resend_credentials(cls, user_id: int, caller: User, request: Any = None) -> bool:
        user = User.objects.get(pk=user_id)
        cls._validate_permissions(caller, user.school, user.role)

        temp_password = cls._generate_temp_password()

        try:
            # Update Supabase
            updated = SupabaseAuthService.update_user(
                auth_user_id=user.auth_user_id,
                email=user.email,
                password=temp_password,
                email_confirm=True,
            )
            if not updated:
                return False

            # Update Django
            user.force_password_change = True
            # If already active, it remains active but will force change
            user.save(update_fields=['force_password_change'])

            # Send Email
            NotificationService.send_credentials_resend(user=user, school=user.school, password=temp_password)

            # Audit
            cls._log_account_action(user, caller, AuditAction.INVITE_SENT, user.school, request=request)

            return True
        except Exception as e:
            logger.error(f"Failed to resend login details for {user.email}: {e}")
            return False

    @classmethod
    def resend_login_details(cls, *args, **kwargs) -> bool:
        # Backward-compatible wrapper for existing callers.
        return cls.resend_credentials(*args, **kwargs)

    @classmethod
    def disable_login(cls, user_id: int, caller: User) -> User:
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user_id)

            # Validation: Cannot disable last school admin
            if user.school and cls._is_last_school_admin(user):
                raise ValueError(cls.LAST_ADMIN_DISABLE_ERROR)

            # Permission check
            cls._validate_permissions(caller, user.school, user.role)

            cls._set_account_state(
                user,
                status=AccountStatus.DISABLED,
                login_enabled=False,
                is_active=False,
            )

        # Revoke Sessions
        cls._revoke_django_sessions(user)
        cls._revoke_supabase_sessions(user)

        # Audit
        cls._log_account_action(user, caller, AuditAction.DISABLE_LOGIN, user.school)

        return user

    @classmethod
    def disable_login_for_entity(cls, *, entity_type: str, entity_id: int, caller: User) -> User:
        user = User.objects.filter(entity_type=str(entity_type or '').lower(), entity_id=entity_id).first()
        if not user:
            raise ValueError(cls.LINKED_ACCOUNT_NOT_FOUND_ERROR)
        return cls.disable_login(user_id=user.id, caller=caller)

    @classmethod
    def assign_role(cls, *, user_id: int, new_role: str, caller: User, request: Any = None) -> User:
        return cls.change_role(user_id=user_id, new_role=new_role, caller=caller, request=request)

    @classmethod
    def change_role(cls, *, user_id: int, new_role: str, caller: User, request: Any = None) -> User:
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user_id).first()
            if not user:
                raise ValueError(cls.USER_NOT_FOUND_ERROR)

            normalized_new_role = normalize_role(new_role)
            cls._validate_permissions(caller, user.school, normalized_new_role)

            old_role = user.role
            user.role = normalized_new_role
            user.save(update_fields=['role', 'updated_at'])

        cls._log_account_action(
            user,
            caller,
            AuditAction.ROLE_CHANGE,
            user.school,
            request=request,
            metadata={
                'old_role': old_role,
                'new_role': normalized_new_role,
            },
        )
        return user

    @classmethod
    def unlock_account(cls, *, user_id: int, caller: User, request: Any = None) -> User:
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user_id).first()
            if not user:
                raise ValueError(cls.USER_NOT_FOUND_ERROR)

            cls._validate_permissions(caller, user.school, user.role)

            cls._set_account_state(
                user,
                status=AccountStatus.ACTIVE,
                login_enabled=True,
                is_active=True,
            )

        cls._log_account_action(user, caller, AuditAction.ACCOUNT_UNLOCKED, user.school, request=request)
        return user

    @classmethod
    def expire_account(cls, *, user_id: int, caller: User, request: Any = None) -> User:
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user_id).first()
            if not user:
                raise ValueError(cls.USER_NOT_FOUND_ERROR)

            if user.school and cls._is_last_school_admin(user):
                raise ValueError(cls.LAST_ADMIN_DISABLE_ERROR)

            cls._validate_permissions(caller, user.school, user.role)

            cls._set_account_state(
                user,
                status=AccountStatus.EXPIRED,
                login_enabled=False,
                is_active=False,
            )

        cls._revoke_django_sessions(user)
        cls._revoke_supabase_sessions(user)
        cls._log_account_action(user, caller, AuditAction.ACCOUNT_EXPIRED, user.school, request=request)
        return user

    @classmethod
    def list_users_for_caller(cls, *, caller: User, role: Optional[str] = None):
        if cls.is_platform_staff(caller):
            queryset = User.objects.filter(school_id__isnull=True)
        elif getattr(caller, 'school_id', None):
            queryset = User.objects.filter(school_id=caller.school_id)
        else:
            queryset = User.objects.none()

        queryset = queryset.order_by('first_name', 'last_name', 'email')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    @classmethod
    def get_login_history_queryset(cls, *, requester: User, target_user_id: int):
        user = User.objects.get(pk=target_user_id)
        if requester.id != user.id:
            cls.ensure_manager_access(requester)
        return LoginHistory.objects.filter(user=user)

    @classmethod
    def touch_login_history(cls, *, user: User, request: Any):
        last_login = LoginHistory.objects.filter(user=user).first()
        now = timezone.now()

        # Avoid duplicate writes on rapid refreshes.
        if not last_login or (now - last_login.login_time).total_seconds() > 1800:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')

            LoginHistory.objects.create(
                user=user,
                ip_address=ip_address,
                user_agent=request.META.get('HTTP_USER_AGENT'),
                successful=True,
            )

            user.last_login = now
            user.save(update_fields=['last_login'])

    @classmethod
    def complete_first_login(cls, *, user: User, request: Any = None):
        user.force_password_change = False
        if user.status == AccountStatus.INVITED:
            user.status = AccountStatus.ACTIVE
        user.save(update_fields=['force_password_change', 'status'])

        log_activity(
            school=user.school,
            actor=user,
            action='first_login_completed',
            description=f'User {user.email} completed first login password change.',
            request=request,
        )

    @classmethod
    def delete_user(cls, *, user_id: int, caller: User):
        cls.ensure_manager_access(caller)

        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user_id).first()
            if not user:
                raise ValueError(cls.USER_NOT_FOUND_ERROR)

            if user.id == caller.id:
                raise ValueError(cls.SELF_DELETE_ERROR)
            if user.school_id and cls._is_last_school_admin(user):
                raise ValueError(cls.LAST_ADMIN_DELETE_ERROR)

            if not user.school_id and user.auth_user_id:
                cls._cleanup_platform_portfolio_assignments(user.auth_user_id)

            user.delete()

    @classmethod
    def repair_platform_auth_links_and_roles(cls):
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
                [list(cls.SYNCABLE_PLATFORM_ROLES)],
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
                [list(cls.SYNCABLE_PLATFORM_ROLES)],
            )
            role_grants = cursor.rowcount

        return {'linked_users': linked_users, 'role_grants': role_grants}

    @classmethod
    def preview_role_change(cls, *, caller: User, user_id: int, new_role: str):
        cls.ensure_manager_access(caller)
        staff = User.objects.get(pk=user_id)
        return get_role_change_impact(staff_id=staff.id, new_role=new_role)

    @classmethod
    def apply_role_change(
        cls,
        *,
        caller: User,
        user_id: int,
        new_role: str,
        strategy: str,
        keep_lead_ids: list[int],
        keep_school_ids: list[int],
        target_staff_ids: dict,
        notes: str,
    ):
        cls.ensure_manager_access(caller)
        staff = User.objects.get(pk=user_id)
        result = change_staff_role(
            staff_id=staff.id,
            initiated_by_id=caller.id,
            new_role=new_role,
            strategy=strategy,
            keep_lead_ids=keep_lead_ids,
            keep_school_ids=keep_school_ids,
            target_staff_ids=target_staff_ids,
            notes=notes,
        )
        staff.refresh_from_db()
        return staff, result

    @staticmethod
    def _cleanup_platform_portfolio_assignments(auth_user_id: str):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_portfolio_assignments')"
            )
            if cursor.fetchone()[0]:
                cursor.execute(
                    'DELETE FROM school_portfolio_assignments WHERE owner_user_id = %s',
                    [auth_user_id],
                )

    @staticmethod
    def _set_account_state(
        user: User,
        *,
        status: str,
        login_enabled: bool,
        is_active: bool,
        force_password_change: Optional[bool] = None,
    ):
        user.status = status
        user.login_enabled = login_enabled
        user.is_active = is_active
        update_fields = ['status', 'login_enabled', 'is_active']
        if force_password_change is not None:
            user.force_password_change = force_password_change
            update_fields.append('force_password_change')
        user.save(update_fields=update_fields)

    @staticmethod
    def _validate_permissions(caller: User, target_school: Optional[Any], target_role: str):
        caller_role = normalize_role(getattr(caller, 'role', '')).lower()
        is_platform_staff = bool(caller.is_superuser or caller.is_staff or (not getattr(caller, 'school_id', None) and caller_role in AccountService.PLATFORM_STAFF_ROLES))

        if is_platform_staff:
            return

        if target_school:
            is_school_admin = bool(getattr(caller, 'school_id', None) == getattr(target_school, 'id', None) and caller_role in AccountService.ADMIN_ROLES)
            if is_school_admin:
                return
            raise PermissionError("You do not have permission to manage users for this school.")

        raise PermissionError("Only platform administrators can manage platform-level users.")

    @staticmethod
    def _find_existing_user(email: str, entity_type: Optional[str], entity_id: Optional[int]) -> Optional[User]:
        if entity_type and entity_id:
            user = User.objects.filter(entity_type=entity_type.lower(), entity_id=entity_id).first()
            if user:
                raise ValueError(AccountService.ENTITY_ALREADY_LINKED_ERROR)

        return User.objects.filter(email__iexact=email).first()

    @staticmethod
    def _sync_supabase_user(user: User, password: Optional[str] = None, send_invite: bool = False):
        if user.auth_user_id:
            if send_invite:
                SupabaseAuthService.reset_password(email=user.email)

            SupabaseAuthService.update_user(
                auth_user_id=user.auth_user_id,
                email=user.email,
                password=password,
            )
            return

        created = SupabaseAuthService.create_user(
            email=user.email,
            password=password,
            full_name=f"{user.first_name} {user.last_name}".strip(),
            email_confirm=True,
            send_invite=send_invite,
        )
        if created and created.get('id'):
            user.auth_user_id = created.get('id')
            user.save(update_fields=['auth_user_id'])

    @staticmethod
    def _revoke_django_sessions(user: User):
        # Optimization: In standard Django, we can't easily query sessions by user ID
        # without iterating. To mitigate O(N), we only check unexpired sessions.
        from django.contrib.sessions.models import Session
        sessions = Session.objects.filter(expire_date__gte=timezone.now())
        for session in sessions:
            try:
                if session.get_decoded().get('_auth_user_id') == str(user.id):
                    session.delete()
            except Exception:
                continue

    @staticmethod
    def _revoke_supabase_sessions(user: User):
        if user.auth_user_id:
            SupabaseAuthService.revoke_sessions(auth_user_id=user.auth_user_id)

    @staticmethod
    def _is_last_school_admin(user: User) -> bool:
        user_role = normalize_role(user.role)
        if user_role not in AccountService.ADMIN_ROLES:
            return False

        other_admins = User.objects.filter(
            school=user.school,
            is_active=True,
            login_enabled=True
        ).exclude(pk=user.pk)

        actual_other_admin_count = 0
        for u in other_admins:
            if normalize_role(u.role) in AccountService.ADMIN_ROLES:
                actual_other_admin_count += 1

        return actual_other_admin_count == 0

    @staticmethod
    def _log_account_action(user: User, actor: User, action: str, school: Optional[Any], request: Any = None, metadata: Optional[dict] = None):
        if school:
            payload = {
                "target_user_id": user.id,
                "target_email": user.email,
                "role": user.role,
                "entity_type": user.entity_type,
                "entity_id": user.entity_id,
            }
            if metadata:
                payload.update(metadata)
            log_activity(
                school=school,
                actor=actor,
                action=action,
                description=f"Account action {action} on {user.email}.",
                metadata=payload,
                request=request
            )

    @staticmethod
    def _send_branded_welcome_email(user: User, school: Optional[Any], password: str, is_reset: bool = False, is_resend: bool = False):
        # Backward-compatible bridge during service extraction.
        if is_reset:
            NotificationService.send_password_reset(user=user, school=school, password=password)
            return
        if is_resend:
            NotificationService.send_credentials_resend(user=user, school=school, password=password)
            return
        NotificationService.send_welcome_email(user=user, school=school, password=password)
