import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Create or reset superuser from ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL env vars'

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()

        if not username or not password:
            self.stdout.write(self.style.WARNING(
                'ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping admin creation.'
            ))
            return

        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        if email:
            user.email = email
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} superuser: {username}'))
