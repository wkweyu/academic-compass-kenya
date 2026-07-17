from __future__ import annotations

import secrets
import string
from typing import Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

from apps.users.supabase_auth_service import SupabaseAuthService


class Command(BaseCommand):
    help = "Update a school admin's email (optionally update Supabase Auth then sync local User)."

    def add_arguments(self, parser):
        parser.add_argument("--school-code", required=True, help="School code, e.g. SCH555")
        parser.add_argument("--old-email", required=True, help="Current email of the admin to update")
        parser.add_argument("--new-email", required=True, help="New email to set for the admin")
        parser.add_argument("--password", required=False, help="Temporary password to set (will be generated if omitted)")
        parser.add_argument("--supabase", action="store_true", help="Also update Supabase Auth (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)")
        parser.add_argument("--apply", action="store_true", help="Actually perform updates. Without this the command runs as dry-run")

    def handle(self, *args, **options):
        school_code = options["school_code"].strip()
        old_email = options["old_email"].strip().lower()
        new_email = options["new_email"].strip().lower()
        provided_password = options.get("password")
        use_supabase = options.get("supabase")
        do_apply = options.get("apply")

        User = get_user_model()

        # generate a temporary password if not provided
        temp_password = provided_password or self._generate_password()

        # find School lazily to avoid hard dependency if apps path differs
        try:
            from apps.schools.models import School

        except Exception as exc:
            raise CommandError(f"Could not import School model: {exc}")

        try:
            school = School.objects.get(code=school_code)
        except School.DoesNotExist:
            raise CommandError(f"School with code {school_code} not found")

        # try to find the user scoped to the school
        users_qs = User.objects.filter(email__iexact=old_email)
        # prefer scoped lookup if model has 'school' FK
        try:
            users_qs = users_qs.filter(school=school)
        except Exception:
            # model may not have 'school' relation; keep the broader search
            pass

        count = users_qs.count()
        if count == 0:
            raise CommandError(f"No user found with email {old_email} for school {school_code}")
        if count > 1:
            raise CommandError(f"Multiple users ({count}) found for {old_email}; please disambiguate before running this command")

        user = users_qs.first()

        # check that new email isn't already taken by another user
        collision_qs = User.objects.filter(email__iexact=new_email).exclude(pk=user.pk)
        if collision_qs.exists():
            raise CommandError(f"New email {new_email} is already in use by another account")

        # Supabase update (if requested)
        auth_user_id = getattr(user, "auth_user_id", None)
        if use_supabase:
            if not SupabaseAuthService._is_configured():
                raise CommandError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment to use --supabase")

            if not auth_user_id:
                raise CommandError("User does not have an 'auth_user_id' field populated; cannot update Supabase without it")

            self.stdout.write(f"Supabase update requested for auth_user_id={auth_user_id}")
            self.stdout.write("Supabase update call (dry-run): update_user(auth_user_id, email, password, email_confirm=True)")
            if do_apply:
                updated = SupabaseAuthService.update_user(
                    auth_user_id=auth_user_id,
                    email=new_email,
                    password=temp_password,
                    email_confirm=True,
                )
                if not updated:
                    raise CommandError("Supabase update failed")
                self.stdout.write(self.style.SUCCESS("Supabase auth user updated"))

        # Local Django update
        self.stdout.write("Local update (dry-run): user -> %s (id=%s)" % (new_email, user.pk))
        if do_apply:
            with transaction.atomic():
                user.email = new_email
                # keep username in sync if present
                if hasattr(user, "username"):
                    try:
                        user.username = new_email
                    except Exception:
                        # some custom user models may not allow changing username
                        pass

                user.is_active = True
                user.set_password(temp_password)
                user.save()

                # update allauth EmailAddress if present
                try:
                    from allauth.account.models import EmailAddress

                    EmailAddress.objects.filter(user=user).delete()
                    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
                except Exception:
                    # allauth not installed or create fails; ignore
                    pass

            self.stdout.write(self.style.SUCCESS(f"Local user updated: id={user.pk}, email={user.email}"))
            self.stdout.write(self.style.WARNING(f"Temporary password set: {temp_password}"))
        else:
            self.stdout.write(self.style.WARNING("Dry-run mode: no changes were written. Rerun with --apply to commit."))

        self.stdout.write(self.style.SUCCESS("Done."))

    def _generate_password(self, length: int = 14) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_"
        return "".join(secrets.choice(alphabet) for _ in range(length))
