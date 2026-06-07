from django.core.management.base import BaseCommand
from apps.payments.models import SchoolPaymentConfig
from apps.schools.models import School

class Command(BaseCommand):
    help = 'Create SchoolPaymentConfig(provider=manual) for every school that lacks one.'

    def handle(self, *args, **options):
        created = skipped = 0
        for school in School.objects.all():
            _, was_created = SchoolPaymentConfig.objects.get_or_create(
                provider='manual',
                school=school,
                defaults={
                    'short_code': f'MANUAL-{school.code}',
                    'account_name': 'Manual Entry',
                    'is_active': True,
                },
            )
            if was_created:
                created += 1
            else:
                skipped += 1
        self.stdout.write(self.style.SUCCESS(
            f'Done. Created: {created}, already existed: {skipped}'
        ))