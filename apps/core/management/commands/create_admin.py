import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Create or reset superuser from ADMIN_EMAIL / ADMIN_PASSWORD env vars'

    def handle(self, *args, **options):
        User = get_user_model()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()
        username = os.environ.get('ADMIN_USERNAME', '').strip()

        if not password or not email:
            # Also fix any existing superuser with NULL password
            broken = User.objects.filter(is_superuser=True, password__isnull=True)
            if broken.exists():
                self.stdout.write(self.style.ERROR(
                    f'{broken.count()} superuser(s) have NULL password. '
                    'Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to fix them.'
                ))
                for u in broken:
                    self.stdout.write(f'  - {u.email} (username={u.username})')
            else:
                self.stdout.write(self.style.WARNING(
                    'ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin creation.'
                ))
            return

        self.stdout.write(f'Looking for user with email={email} ...')

        # Look up by email (the USERNAME_FIELD), fall back to creating
        user = User.objects.filter(email=email).first()
        if user is None:
            # Try by username if provided
            if username:
                user = User.objects.filter(username=username).first()
        if user is None:
            # Also check for any superuser with NULL password to repair
            user = User.objects.filter(is_superuser=True, password__isnull=True).first()

        if user is None:
            # Create fresh
            uname = username or email.split('@')[0]
            user = User(username=uname, email=email)
            created = True
        else:
            created = False

        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.email = email
        if username:
            user.username = username
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} superuser: {user.email}'))
