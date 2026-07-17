import logging
from typing import Any, Optional

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    def _send_staff_template_email(*, user: Any, school: Optional[Any], password: str, subject: str) -> None:
        if not school or not getattr(user, 'email', None):
            return

        context = {
            'name': getattr(user, 'first_name', '') or getattr(user, 'full_name', '') or user.email,
            'school_name': school.name,
            'role': getattr(user, 'role', ''),
            'email': user.email,
            'password': password,
            'login_url': "https://academic-compass-web.onrender.com",
        }

        html_message = render_to_string('emails/welcome_staff.html', context)
        plain_message = render_to_string('emails/welcome_staff.txt', context)

        try:
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@academic-compass.com'),
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info("Email sent to %s with subject '%s'", user.email, subject)
        except Exception as exc:
            logger.error("Failed to send email to %s: %s", user.email, exc)

    @classmethod
    def send_welcome_email(cls, *, user: Any, school: Optional[Any], password: str) -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Welcome to Academic Compass",
        )

    @classmethod
    def send_credentials(cls, *, user: Any, school: Optional[Any], password: str) -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Welcome to Academic Compass",
        )

    @classmethod
    def send_password_reset(cls, *, user: Any, school: Optional[Any], password: str) -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Your Academic Compass Password has been Reset",
        )

    @classmethod
    def send_role_changed(cls, *, user: Any, school: Optional[Any], password: str = "") -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Your Academic Compass Role Was Updated",
        )

    @classmethod
    def send_account_disabled(cls, *, user: Any, school: Optional[Any], password: str = "") -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Your Academic Compass Account Was Disabled",
        )

    @classmethod
    def send_credentials_resend(cls, *, user: Any, school: Optional[Any], password: str) -> None:
        cls._send_staff_template_email(
            user=user,
            school=school,
            password=password,
            subject="Your Academic Compass Login Details",
        )
