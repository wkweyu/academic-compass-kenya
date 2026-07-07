from datetime import date

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.users.models import User


class EnableLoginViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(name='Test School', code='SCH555')
        self.school_admin = User.objects.create_user(
            username='school-admin',
            email='school-admin@example.com',
            password='password123',
            first_name='School',
            last_name='Admin',
            role='schooladmin',
            school=self.school,
            is_active=True,
        )
        self.teacher = Teacher.objects.create(
            school=self.school,
            first_name='Jane',
            last_name='Doe',
            full_name='Jane Doe',
            tsc_number='TSC001',
            gender='F',
            date_of_birth=date(1990, 1, 1),
            phone='0712345678',
            email='jane.doe@example.com',
            date_joined=date(2020, 1, 1),
        )

    def test_school_admin_can_enable_login_for_existing_teacher(self):
        self.client.force_authenticate(self.school_admin)

        response = self.client.post(
            '/api/users/enable-login/',
            {
                'entity_type': 'teacher',
                'entity_id': self.teacher.id,
                'email': 'jane.doe@example.com',
                'role': 'accountant',
                'send_invite': False,
                'login_enabled': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['entity_type'], 'teacher')
        self.assertEqual(response.data['entity_id'], self.teacher.id)
        self.assertEqual(response.data['role'], 'accountant')
        self.assertTrue(response.data['login_enabled'])

        user = User.objects.get(email='jane.doe@example.com')
        self.assertEqual(user.school, self.school)
        self.assertEqual(user.entity_type, 'teacher')
        self.assertEqual(user.entity_id, self.teacher.id)
        self.assertTrue(user.login_enabled)
        self.assertEqual(user.status, 'ACTIVE')
