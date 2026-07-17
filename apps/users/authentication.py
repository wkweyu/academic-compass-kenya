from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed

import requests

from .services import AccountService


User = get_user_model()


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """Authenticates Django requests using the active Supabase access token."""

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode('utf-8')
        if not auth_header:
            return None

        try:
            scheme, token = auth_header.split(' ', 1)
        except ValueError:
            return None

        if scheme.lower() != 'bearer' or not token:
            return None

        supabase_url = getattr(settings, 'SUPABASE_PROJECT_URL', '')
        supabase_anon_key = getattr(settings, 'SUPABASE_ANON_KEY', '')
        if not supabase_url or not supabase_anon_key:
            return None

        try:
            response = requests.get(
                f"{supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    'apikey': supabase_anon_key,
                    'Authorization': f'Bearer {token}',
                },
                timeout=10,
            )
        except requests.RequestException:
            # Supabase is unreachable (e.g. project paused, DNS failure, network error).
            # Return None so DRF tries the next authentication backend instead of hard-failing.
            return None

        if response.status_code == 401:
            return None
        if response.status_code >= 400:
            raise AuthenticationFailed('Supabase session validation failed.')

        payload = response.json()
        auth_user_id = payload.get('id')
        email = (payload.get('email') or '').strip().lower()
        if not auth_user_id:
            return None

        user = User.objects.filter(auth_user_id=auth_user_id).first()
        if user is None and email:
            user = User.objects.filter(email__iexact=email).first()
            if user and not user.auth_user_id:
                user.auth_user_id = auth_user_id
                user.save(update_fields=['auth_user_id'])

        if user is None:
            raise AuthenticationFailed('No Django user is linked to this Supabase account.')
        if user.expires_at and user.expires_at <= timezone.now():
            if user.school_id and AccountService._is_last_school_admin(user):
                return (user, token)
            user.status = 'EXPIRED'
            user.login_enabled = False
            user.is_active = False
            user.save(update_fields=['status', 'login_enabled', 'is_active'])
            raise AuthenticationFailed('User account has expired.')
        if not getattr(user, 'login_enabled', True):
            raise AuthenticationFailed('Login is disabled for this account.')
        if not user.is_active:
            raise AuthenticationFailed('User account is inactive.')

        return (user, token)


class SafeModelBackend:
    """
    Drop-in replacement for django.contrib.auth.backends.ModelBackend that
    handles users whose password field is NULL (e.g. Supabase-only accounts
    or accounts created without set_password). Returns None (auth failure)
    instead of crashing with TypeError in identify_hasher.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()

        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        try:
            user = UserModel._default_manager.get_by_natural_key(username)
        except UserModel.DoesNotExist:
            # Run the hasher anyway to reduce timing differences
            UserModel().set_password(password)
            return None

        if user.password is None:
            return None  # NULL password — silently reject instead of crashing

        try:
            auth_ok = user.check_password(password)
        except (ValueError, TypeError):
            return None

        if auth_ok and self.user_can_authenticate(user):
            return user
        return None

    def user_can_authenticate(self, user):
        return getattr(user, 'is_active', False)

    def get_user(self, user_id):
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()
        try:
            user = UserModel._default_manager.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None
        return user if self.user_can_authenticate(user) else None