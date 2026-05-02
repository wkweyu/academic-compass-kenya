from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed

import requests


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
        except requests.RequestException as exc:
            raise AuthenticationFailed('Unable to validate Supabase session.') from exc

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
        if not user.is_active:
            raise AuthenticationFailed('User account is inactive.')

        return (user, token)