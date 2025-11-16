#!/usr/bin/env python
"""
Backend Health Check Script
Run this to verify your Django backend is properly configured
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'skooltrack_pro.settings')
django.setup()

from apps.users.models import User
from apps.schools.models import School
from apps.teachers.models import Teacher
from django.db import connection

print("=" * 60)
print("BACKEND HEALTH CHECK")
print("=" * 60)

# 1. Check database connection
print("\n1. Testing database connection...")
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    print("   ✓ Database connection successful")
except Exception as e:
    print(f"   ✗ Database connection failed: {e}")
    sys.exit(1)

# 2. Check if teachers table exists
print("\n2. Checking teachers table...")
try:
    Teacher.objects.count()
    print("   ✓ Teachers table exists")
except Exception as e:
    print(f"   ✗ Teachers table error: {e}")
    print("   → Run: python manage.py migrate")

# 3. Check users
print("\n3. Checking users...")
try:
    user_count = User.objects.count()
    print(f"   ✓ Found {user_count} user(s)")
    
    if user_count > 0:
        first_user = User.objects.first()
        print(f"   → First user: {first_user.email}")
        print(f"   → School ID: {first_user.school_id}")
        
        if not first_user.school_id:
            print("   ⚠ WARNING: User has no school_id!")
            print("   → This will prevent creating teachers")
    else:
        print("   ⚠ No users found - create a user first")
except Exception as e:
    print(f"   ✗ Users table error: {e}")

# 4. Check schools
print("\n4. Checking schools...")
try:
    school_count = School.objects.count()
    print(f"   ✓ Found {school_count} school(s)")
    
    if school_count == 0:
        print("   ⚠ No schools found - create a school profile first")
except Exception as e:
    print(f"   ✗ Schools table error: {e}")

# 5. Check teachers
print("\n5. Checking teachers...")
try:
    teacher_count = Teacher.objects.count()
    print(f"   ✓ Found {teacher_count} teacher(s)")
except Exception as e:
    print(f"   ✗ Teachers check error: {e}")

# 6. Test creating a teacher (dry run)
print("\n6. Testing teacher creation permissions...")
try:
    # Get first user with school
    user = User.objects.filter(school_id__isnull=False).first()
    if user:
        print(f"   ✓ Found user with school: {user.email}")
        print(f"   ✓ School ID: {user.school_id}")
    else:
        print("   ✗ No user with school_id found")
        print("   → Assign a school to your user first")
except Exception as e:
    print(f"   ✗ Permission check error: {e}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print("\nIf all checks passed, your backend should be ready.")
print("If there are errors, follow the suggestions above.")
print("\nNext steps:")
print("1. Start Django: python manage.py runserver")
print("2. Test API: http://localhost:8000/api/teachers/")
print("3. Try registering a teacher in the frontend")
print("=" * 60)
