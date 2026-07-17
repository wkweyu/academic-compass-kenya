import logging
import os
from typing import Any, Optional

import requests
from django.conf import settings


logger = logging.getLogger(__name__)


class SupabaseAuthService:
    @staticmethod
    def _get_base_url() -> str:
        return (os.environ.get("SUPABASE_URL") or getattr(settings, "SUPABASE_PROJECT_URL", "") or "").rstrip("/")

    @staticmethod
    def _get_service_key() -> str:
        return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    @classmethod
    def _is_configured(cls) -> bool:
        return bool(cls._get_base_url() and cls._get_service_key())

    @classmethod
    def _admin_headers(cls) -> dict[str, str]:
        service_key = cls._get_service_key()
        return {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json",
        }

    @classmethod
    def get_user_from_access_token(cls, *, token: str) -> Optional[dict[str, Any]]:
        base_url = cls._get_base_url()
        anon_key = os.environ.get("SUPABASE_ANON_KEY") or getattr(settings, "SUPABASE_ANON_KEY", "")
        if not base_url or not anon_key or not token:
            return None

        endpoint = f"{base_url}/auth/v1/user"
        headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
        }
        try:
            resp = requests.get(endpoint, headers=headers, timeout=10)
            if resp.status_code == 401:
                return None
            if resp.status_code >= 400:
                logger.error("Supabase token introspection failed: %s", resp.text)
                return None
            data = resp.json()
            return data if isinstance(data, dict) else None
        except requests.RequestException:
            return None

    @classmethod
    def create_user(
        cls,
        *,
        email: str,
        password: Optional[str] = None,
        full_name: str = "",
        email_confirm: bool = True,
        send_invite: bool = False,
    ) -> Optional[dict[str, Any]]:
        if not cls._is_configured():
            logger.warning("Supabase configuration missing; skipping create_user.")
            return None

        endpoint = f"{cls._get_base_url()}/auth/v1/admin/users"
        payload: dict[str, Any] = {
            "email": email,
            "user_metadata": {"full_name": full_name.strip()},
            "email_confirm": email_confirm,
        }

        if send_invite:
            endpoint = f"{cls._get_base_url()}/auth/v1/admin/invite"
            payload.pop("email_confirm", None)
        else:
            payload["password"] = password or "ChangeMe123!"

        try:
            resp = requests.post(endpoint, headers=cls._admin_headers(), json=payload, timeout=10)
            if resp.status_code == 201:
                data = resp.json()
                return data if isinstance(data, dict) else {}
            if resp.status_code == 400 and "already registered" in resp.text:
                logger.info("Supabase user for %s already exists.", email)
                return None
            logger.error("Supabase create_user error: %s", resp.text)
            resp.raise_for_status()
        except Exception as exc:
            logger.error("Failed to create Supabase user for %s: %s", email, exc)
        return None

    @classmethod
    def update_user(
        cls,
        *,
        auth_user_id: str,
        email: Optional[str] = None,
        password: Optional[str] = None,
        email_confirm: Optional[bool] = None,
        ban_duration: Optional[str] = None,
    ) -> bool:
        if not auth_user_id:
            return False
        if not cls._is_configured():
            logger.warning("Supabase configuration missing; skipping update_user.")
            return False

        payload: dict[str, Any] = {}
        if email is not None:
            payload["email"] = email
        if password is not None:
            payload["password"] = password
        if email_confirm is not None:
            payload["email_confirm"] = email_confirm
        if ban_duration is not None:
            payload["ban_duration"] = ban_duration

        if not payload:
            return True

        endpoint = f"{cls._get_base_url()}/auth/v1/admin/users/{auth_user_id}"
        try:
            resp = requests.patch(endpoint, headers=cls._admin_headers(), json=payload, timeout=10)
            if resp.status_code >= 400:
                logger.error("Supabase update_user error: %s", resp.text)
            resp.raise_for_status()
            return True
        except Exception as exc:
            logger.error("Failed to update Supabase user %s: %s", auth_user_id, exc)
            return False

    @classmethod
    def delete_user(cls, *, auth_user_id: str) -> bool:
        if not auth_user_id:
            return False
        if not cls._is_configured():
            logger.warning("Supabase configuration missing; skipping delete_user.")
            return False

        endpoint = f"{cls._get_base_url()}/auth/v1/admin/users/{auth_user_id}"
        try:
            resp = requests.delete(endpoint, headers=cls._admin_headers(), timeout=10)
            if resp.status_code in (200, 204):
                return True
            logger.error("Supabase delete_user error: %s", resp.text)
        except Exception as exc:
            logger.error("Failed to delete Supabase user %s: %s", auth_user_id, exc)
        return False

    @classmethod
    def reset_password(cls, *, email: str) -> bool:
        """Trigger Supabase recovery email for an existing account."""
        if not email:
            return False
        base_url = cls._get_base_url()
        anon_key = os.environ.get("SUPABASE_ANON_KEY") or getattr(settings, "SUPABASE_ANON_KEY", "")
        if not base_url or not anon_key:
            logger.warning("Supabase anon configuration missing; skipping reset_password.")
            return False

        endpoint = f"{base_url}/auth/v1/recover"
        headers = {
            "apikey": anon_key,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(endpoint, headers=headers, json={"email": email}, timeout=10)
            return resp.status_code < 400
        except Exception as exc:
            logger.error("Failed to trigger Supabase recovery email for %s: %s", email, exc)
            return False

    @classmethod
    def set_password(cls, *, auth_user_id: str, password: str) -> bool:
        return cls.update_user(auth_user_id=auth_user_id, password=password)

    @classmethod
    def revoke_sessions(cls, *, auth_user_id: str) -> bool:
        if not auth_user_id:
            return False
        if not cls._is_configured():
            return False

        endpoint = f"{cls._get_base_url()}/auth/v1/admin/users/{auth_user_id}/logout"
        try:
            resp = requests.post(endpoint, headers=cls._admin_headers(), timeout=10)
            return resp.status_code < 400
        except Exception as exc:
            logger.error("Failed to revoke Supabase sessions for %s: %s", auth_user_id, exc)
            return False

    @classmethod
    def disable_user(cls, *, auth_user_id: str) -> bool:
        # Long ban_duration effectively disables sign-in.
        return cls.update_user(auth_user_id=auth_user_id, ban_duration="876000h")

    @classmethod
    def enable_user(cls, *, auth_user_id: str) -> bool:
        return cls.update_user(auth_user_id=auth_user_id, ban_duration="none")
