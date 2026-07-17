from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.users.models import AccountStatus, User
from apps.users.services import AccountService


class Command(BaseCommand):
    help = 'Expire user accounts where expires_at is in the past.'

    def handle(self, *args, **options):
        now = timezone.now()
        candidates = User.objects.filter(
            expires_at__isnull=False,
            expires_at__lte=now,
        ).exclude(status=AccountStatus.EXPIRED)

        updated = 0
        skipped = 0
        for user in candidates:
            if user.school_id and AccountService._is_last_school_admin(user):
                skipped += 1
                continue

            user.status = AccountStatus.EXPIRED
            user.login_enabled = False
            user.is_active = False
            user.updated_at = now
            user.save(update_fields=['status', 'login_enabled', 'is_active', 'updated_at'])
            updated += 1

        self.stdout.write(self.style.SUCCESS(f'Expired {updated} account(s). Skipped {skipped} last-admin account(s).'))
