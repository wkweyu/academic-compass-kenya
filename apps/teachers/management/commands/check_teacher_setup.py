from django.core.management.base import BaseCommand
from django.db import connection
from apps.users.models import User
from apps.schools.models import School
from apps.teachers.models import Teacher

class Command(BaseCommand):
    help = 'Check teacher module setup and diagnose issues'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('TEACHER MODULE DIAGNOSTICS'))
        self.stdout.write(self.style.SUCCESS('='*60 + '\n'))

        # Check 1: Database tables
        self.stdout.write('1. Checking database tables...')
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema='public' 
                    AND table_name IN ('teachers', 'users', 'schools_school')
                """)
                tables = [row[0] for row in cursor.fetchall()]
                
                if 'teachers' in tables:
                    self.stdout.write(self.style.SUCCESS('   ✓ teachers table exists'))
                else:
                    self.stdout.write(self.style.ERROR('   ✗ teachers table missing'))
                    self.stdout.write('   → Run: python manage.py migrate teachers')
                
                if 'users' in tables:
                    self.stdout.write(self.style.SUCCESS('   ✓ users table exists'))
                else:
                    self.stdout.write(self.style.ERROR('   ✗ users table missing'))
                    
                if 'schools_school' in tables:
                    self.stdout.write(self.style.SUCCESS('   ✓ schools_school table exists'))
                else:
                    self.stdout.write(self.style.ERROR('   ✗ schools_school table missing'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ✗ Database check failed: {e}'))

        # Check 2: Users with schools
        self.stdout.write('\n2. Checking users...')
        try:
            total_users = User.objects.count()
            users_with_school = User.objects.filter(school_id__isnull=False).count()
            
            self.stdout.write(f'   Total users: {total_users}')
            self.stdout.write(f'   Users with school: {users_with_school}')
            
            if users_with_school == 0 and total_users > 0:
                self.stdout.write(self.style.WARNING('   ⚠ No users have school assigned!'))
                self.stdout.write('   → Create a school profile first')
            elif users_with_school > 0:
                sample_user = User.objects.filter(school_id__isnull=False).first()
                self.stdout.write(self.style.SUCCESS(f'   ✓ Sample user: {sample_user.email} (school_id: {sample_user.school_id})'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ✗ User check failed: {e}'))

        # Check 3: Schools
        self.stdout.write('\n3. Checking schools...')
        try:
            school_count = School.objects.count()
            self.stdout.write(f'   Total schools: {school_count}')
            
            if school_count == 0:
                self.stdout.write(self.style.WARNING('   ⚠ No schools exist'))
                self.stdout.write('   → Create a school in Settings > School Profile')
            else:
                self.stdout.write(self.style.SUCCESS(f'   ✓ {school_count} school(s) found'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ✗ School check failed: {e}'))

        # Check 4: Existing teachers
        self.stdout.write('\n4. Checking teachers...')
        try:
            teacher_count = Teacher.objects.count()
            self.stdout.write(f'   Total teachers: {teacher_count}')
            
            if teacher_count > 0:
                self.stdout.write(self.style.SUCCESS(f'   ✓ {teacher_count} teacher(s) registered'))
                # Show sample
                sample = Teacher.objects.first()
                self.stdout.write(f'   Sample: {sample.full_name} (school_id: {sample.school_id})')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ✗ Teacher check failed: {e}'))

        # Check 5: Table structure
        self.stdout.write('\n5. Verifying teachers table structure...')
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema='public' 
                    AND table_name='teachers'
                    AND column_name IN ('school_id', 'first_name', 'last_name', 'tsc_number')
                """)
                columns = cursor.fetchall()
                
                required_cols = ['school_id', 'first_name', 'last_name', 'tsc_number']
                found_cols = [col[0] for col in columns]
                
                for col in required_cols:
                    if col in found_cols:
                        self.stdout.write(self.style.SUCCESS(f'   ✓ Column {col} exists'))
                    else:
                        self.stdout.write(self.style.ERROR(f'   ✗ Column {col} missing'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ✗ Structure check failed: {e}'))

        # Summary
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('NEXT STEPS'))
        self.stdout.write(self.style.SUCCESS('='*60))
        self.stdout.write('1. Ensure Django server is running: python manage.py runserver')
        self.stdout.write('2. Check frontend can reach: http://localhost:8000/api/teachers/')
        self.stdout.write('3. Verify user is logged in with valid token')
        self.stdout.write('4. Ensure user has school_id assigned')
        self.stdout.write(self.style.SUCCESS('='*60 + '\n'))
