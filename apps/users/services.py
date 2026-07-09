import logging
import os
from datetime import datetime
from typing import Optional, Tuple, Any

from django.conf import settings
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

import requests

from apps.schools.services import log_activity, send_notification, normalize_role
from apps.students.models import Student
from apps.teachers.models import Teacher

logger = logging.getLogger(__name__)
User = get_user_model()

class AccountService:
    @staticmethod
    def _resolve_entity(entity_type: str, entity_id: int) -> Any:
        normalized_type = str(entity_type or '').strip().lower()
        if normalized_type in {'teacher', 'teachers', 'staff'}:
            # Support both teacher and staff mapping to Teacher model if that is the source of truth
            return Teacher.objects.filter(pk=entity_id).first()
        if normalized_type in {'student', 'students'}:
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
    def provision_account(
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
    ) -> User:
        email = email.strip().lower()
        role = normalize_role(role)

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
                status = 'DISABLED'
            elif send_invite:
                status = 'INVITED'
            else:
                status = 'ACTIVE'

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
                    expires_at=expires_at,
                    is_active=login_enabled and status in {'ACTIVE', 'INVITED', 'PENDING_EMAIL_VERIFICATION'},
                    is_staff=is_platform_user # Platform users are Django staff by default in this system
                )
                if password:
                    user.set_password(password)
                    user.save(update_fields=['password'])
            else:
                user.username = cls._build_unique_username(email, exclude_user_id=user.id)
                user.email = email
                user.role = role
                user.school = school
                user.entity_type = entity_type or user.entity_type
                user.entity_id = entity_id or user.entity_id
                user.first_name = first_name or user.first_name
                user.last_name = last_name or user.last_name
                user.status = status
                user.login_enabled = login_enabled
                user.expires_at = expires_at
                user.is_active = login_enabled and status in {'ACTIVE', 'INVITED', 'PENDING_EMAIL_VERIFICATION'}
                # Preserve is_staff status for existing users or update if becoming platform user
                if is_platform_user:
                    user.is_staff = True
                user.save()

        # 6. Supabase Sync (outside transaction)
        cls._sync_supabase_user(user, password, send_invite=send_invite)

        # 7. Audit Logging
        cls._log_account_action(user, caller, "account_provisioned", school or user.school)

        # 8. Notification
        if send_invite and login_enabled:
            cls._send_invitation(user, school or user.school)

        return user

    @classmethod
    def send_password_reset(cls, user_id: int, caller: User) -> bool:
        user = User.objects.get(pk=user_id)

        # Permission check
        cls._validate_permissions(caller, user.school, user.role)

        if not user.auth_user_id:
            logger.warning(f"Cannot send reset email for {user.email}: No Supabase auth_user_id found.")
            return False

        supabase_url = os.environ.get("SUPABASE_URL") or getattr(settings, 'SUPABASE_PROJECT_URL', '')
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not service_key:
            logger.error("Supabase configuration missing; cannot send reset email.")
            return False

        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json"
        }

        # Supabase Admin API: Send OTP / Invite / Magic Link
        # To trigger a password reset email from admin side:
        endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/generate_link"
        payload = {
            "type": "recovery",
            "email": user.email,
        }

        try:
            logger.info(f"Generating password recovery link for {user.email}")
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=10)
            logger.info(f"Supabase generate_link response: {resp.status_code}")

            if resp.status_code == 200:
                # The generate_link API returns the link.
                # If we want Supabase to actually SEND the email, we should use the client-side resetPasswordForEmail
                # OR use the admin API to update user with a password (which we want to avoid)
                # Alternatively, we can use the 'invite' type if they haven't logged in,
                # but for existing users 'recovery' is best.
                # However, generate_link doesn't SEND the email, it just returns the URL.

                # To TRIGGER the email from the server:
                # We can use the regular GOTRUE endpoint but it's rate limited.
                # The better way for ADMIN to trigger it:

                # Using the admin API to send an invite or just letting them know we can't 'trigger'
                # it directly via admin API easily without sending the link ourselves.

                # Actually, there is an endpoint for this in some Gotrue versions:
                # POST /admin/users/{uuid}/otp (not widely documented)

                # Let's try the standard recovery endpoint (non-admin) - but this requires NO service key
                # and uses the public anon key.

                public_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/recover"
                public_headers = {
                    "apikey": os.environ.get("SUPABASE_ANON_KEY") or getattr(settings, 'SUPABASE_ANON_KEY', ''),
                    "Content-Type": "application/json"
                }
                resp = requests.post(public_endpoint, headers=public_headers, json={"email": user.email}, timeout=10)
                logger.info(f"Supabase public recovery response: {resp.status_code}")

                return resp.status_code == 200
            else:
                logger.error(f"Supabase generate_link error: {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to trigger password reset for {user.email}: {e}")
            return False

    @classmethod
    def disable_login(cls, user_id: int, caller: User) -> User:
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user_id)

            # Validation: Cannot disable last school admin
            if user.school and cls._is_last_school_admin(user):
                raise ValueError("Cannot disable the last administrator for this school.")

            # Permission check
            cls._validate_permissions(caller, user.school, user.role)

            user.login_enabled = False
            user.status = 'DISABLED'
            user.is_active = False
            user.save()

        # Revoke Sessions
        cls._revoke_django_sessions(user)
        cls._revoke_supabase_sessions(user)

        # Audit
        cls._log_account_action(user, caller, "account_disabled", user.school)

        return user

    @staticmethod
    def _validate_permissions(caller: User, target_school: Optional[Any], target_role: str):
        PLATFORM_STAFF_ROLES = {'staff', 'sales_rep', 'onboarding_specialist', 'account_manager', 'marketer', 'manager', 'platform_admin', 'support'}

        caller_role = normalize_role(getattr(caller, 'role', '')).lower()
        is_platform_staff = bool(caller.is_superuser or caller.is_staff or (not getattr(caller, 'school_id', None) and caller_role in PLATFORM_STAFF_ROLES))

        if is_platform_staff:
            return

        if target_school:
            is_school_admin = bool(getattr(caller, 'school_id', None) == getattr(target_school, 'id', None) and caller_role in {'admin', 'schooladmin', 'school_admin', 'principal', 'headteacher'})
            if is_school_admin:
                return
            raise PermissionError("You do not have permission to manage users for this school.")

        raise PermissionError("Only platform administrators can manage platform-level users.")

    @staticmethod
    def _find_existing_user(email: str, entity_type: Optional[str], entity_id: Optional[int]) -> Optional[User]:
        if entity_type and entity_id:
            user = User.objects.filter(entity_type=entity_type.lower(), entity_id=entity_id).first()
            if user:
                return user

        return User.objects.filter(email__iexact=email).first()

    @staticmethod
    def _sync_supabase_user(user: User, password: Optional[str] = None, send_invite: bool = False):
        supabase_url = os.environ.get("SUPABASE_URL") or getattr(settings, 'SUPABASE_PROJECT_URL', '')
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not service_key:
            logger.warning("Supabase configuration missing; skipping sync.")
            return

        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json"
        }

        if user.auth_user_id:
            # For existing users, if send_invite is true, we should trigger a recovery email
            # as Supabase doesn't have a "re-invite" for confirmed users, but we can use recovery.
            if send_invite:
                logger.info(f"Triggering invite/recovery email for existing user {user.email}")
                public_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/recover"
                public_headers = {
                    "apikey": os.environ.get("SUPABASE_ANON_KEY") or getattr(settings, 'SUPABASE_ANON_KEY', ''),
                    "Content-Type": "application/json"
                }
                try:
                    requests.post(public_endpoint, headers=public_headers, json={"email": user.email}, timeout=10)
                except Exception as e:
                    logger.error(f"Failed to send recovery email: {e}")

            endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{user.auth_user_id}"
            payload = {"email": user.email}
            if password:
                payload["password"] = password

            try:
                logger.info(f"Updating Supabase user: {user.auth_user_id}, payload keys: {list(payload.keys())}")
                resp = requests.patch(endpoint, headers=headers, json=payload, timeout=10)
                logger.info(f"Supabase update response: {resp.status_code}")
                if resp.status_code >= 400:
                    logger.error(f"Supabase update error: {resp.text}")
                resp.raise_for_status()
            except Exception as e:
                logger.error(f"Failed to update Supabase user {user.auth_user_id}: {e}")
        else:
            endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
            # If send_invite is true, we use the Supabase invite flow instead of direct creation
            # to let Supabase handle the email delivery.
            payload = {
                "email": user.email,
                "user_metadata": {
                    "full_name": f"{user.first_name} {user.last_name}".strip(),
                }
            }

            if send_invite:
                # Use invite endpoint
                endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/invite"
            else:
                payload.update({
                    "password": password or "ChangeMe123!",
                    "email_confirm": True,
                })

            try:
                logger.info(f"Creating Supabase user: {user.email}")
                resp = requests.post(endpoint, headers=headers, json=payload, timeout=10)
                logger.info(f"Supabase create response: {resp.status_code}")
                if resp.status_code == 201:
                    data = resp.json()
                    user.auth_user_id = data.get("id")
                    user.save(update_fields=['auth_user_id'])
                    logger.info(f"Supabase user created: {user.auth_user_id}")
                elif resp.status_code == 400 and "already registered" in resp.text:
                    logger.info(f"Supabase user for {user.email} already exists.")
                    # Try to fetch the user to get the ID if we don't have it
                    fetch_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
                    # Note: Supabase admin API doesn't have a direct "get by email" but we can list and filter
                    # but for simplicity we just log it for now.
                else:
                    logger.error(f"Supabase create error: {resp.text}")
                    resp.raise_for_status()
            except Exception as e:
                logger.error(f"Failed to create Supabase user for {user.email}: {e}")

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
        if not user.auth_user_id:
            return

        supabase_url = os.environ.get("SUPABASE_URL") or getattr(settings, 'SUPABASE_PROJECT_URL', '')
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not service_key:
            return

        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        }

        endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{user.auth_user_id}/logout"
        try:
            requests.post(endpoint, headers=headers, timeout=10)
        except Exception as e:
            logger.error(f"Failed to revoke Supabase sessions for {user.auth_user_id}: {e}")

    @staticmethod
    def _is_last_school_admin(user: User) -> bool:
        admin_roles = {'admin', 'schooladmin', 'school_admin', 'principal', 'headteacher'}

        user_role = normalize_role(user.role)
        if user_role not in admin_roles:
            return False

        other_admins = User.objects.filter(
            school=user.school,
            is_active=True,
            login_enabled=True
        ).exclude(pk=user.pk)

        actual_other_admin_count = 0
        for u in other_admins:
            if normalize_role(u.role) in admin_roles:
                actual_other_admin_count += 1

        return actual_other_admin_count == 0

    @staticmethod
    def _log_account_action(user: User, actor: User, action: str, school: Optional[Any]):
        if school:
            log_activity(
                school=school,
                actor=actor,
                action=action,
                description=f"Account for {user.email} was {action.replace('_', ' ')}.",
                metadata={
                    "target_user_id": user.id,
                    "target_email": user.email,
                    "role": user.role,
                    "entity_type": user.entity_type,
                    "entity_id": user.entity_id
                }
            )

    @staticmethod
    def _send_invitation(user: User, school: Optional[Any]):
        if not school:
            return

        try:
            send_notification(
                school=school,
                recipient=user,
                template_key='account_invited',
                variables={
                    'name': user.first_name or user.email,
                    'schoolName': school.name,
                }
            )
        except Exception as e:
            logger.error(f"Failed to send invitation to {user.email}: {e}")
