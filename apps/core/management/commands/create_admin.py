import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import IntegrityError


class Command(BaseCommand):
    help = 'Create or reset superuser from ADMIN_EMAIL / ADMIN_PASSWORD env vars'

    def handle(self, *args, **options):
        User = get_user_model()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()

        if not password or not email:
            self.stdout.write(self.style.WARNING(
                'ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping.'
            ))
            broken = User.objects.filter(is_superuser=True, password__isnull=True)
            for u in broken:
                self.stdout.write(f'  NULL-password account: email={u.email} username={u.username}')
            return

        self.stdout.write(f'create_admin: looking for email={email}')

        # Find target user: by email first, then any superuser with NULL password
        user = User.objects.filter(email=email).first()
        if user:
            self.stdout.write(f'  Found by email: username={user.username} password_is_null={user.password is None}')
        else:
            user = User.objects.filter(is_superuser=True, password__isnull=True).first()
            if user:
                self.stdout.write(f'  Found by NULL-password superuser: username={user.username} email={user.email}')

        if user is None:
            # Generate a guaranteed-unique username
            base = email.split('@')[0]
            uname = base
            counter = 1
            while User.objects.filter(username=uname).exists():
                uname = f'{base}{counter}'
                counter += 1
            user = User(username=uname, email=email)
            self.stdout.write(f'  Creating new user: username={uname}')

        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.email = email  # ensure email is correct

        try:
            user.save()
            self.stdout.write(self.style.SUCCESS(f'create_admin: SUCCESS — {user.email} (username={user.username})'))
        except IntegrityError as e:
            self.stdout.write(self.style.ERROR(f'create_admin: FAILED to save — {e}'))
            raise

