from datetime import date
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.users.models import LinkedEntityType, User
from apps.users.serializers import EnableLoginSerializer
from apps.users.services import AccountService
from apps.users.views import EnableLoginView, UserDeleteView


class UserEntityConstraintTests(TestCase):
    def test_user_entity_link_must_be_unique(self):
        school = School.objects.create(name='Alpha School', code='SCHA001')

        User.objects.create_user(
            username='teacher-one',
            email='teacher.one@example.com',
            password='password123',
            school=school,
            entity_type=LinkedEntityType.TEACHER,
            entity_id=35,
        )

        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username='teacher-two',
                email='teacher.two@example.com',
                password='password123',
                school=school,
                entity_type=LinkedEntityType.TEACHER,
                entity_id=35,
            )


class EnableLoginSerializerTests(TestCase):
    def test_entity_type_and_entity_id_must_be_provided_together(self):
        serializer = EnableLoginSerializer(data={'email': 'x@example.com', 'entity_type': LinkedEntityType.TEACHER})
        self.assertFalse(serializer.is_valid())

        serializer = EnableLoginSerializer(data={'email': 'x@example.com', 'entity_id': 12})
        self.assertFalse(serializer.is_valid())


class AccountServiceIsolationTests(TestCase):
    def setUp(self):
        self.school_a = School.objects.create(name='School A', code='SCHA001')
        self.school_b = School.objects.create(name='School B', code='SCHB001')

        self.school_a_admin = User.objects.create_user(
            username='school-a-admin',
            email='schoola.admin@example.com',
            password='password123',
            role='schooladmin',
            school=self.school_a,
            login_enabled=True,
            status='ACTIVE',
            is_active=True,
        )

        self.school_b_admin = User.objects.create_user(
            username='school-b-admin',
            email='schoolb.admin@example.com',
            password='password123',
            role='schooladmin',
            school=self.school_b,
            login_enabled=True,
            status='ACTIVE',
            is_active=True,
        )

        self.teacher_a = Teacher.objects.create(
            school=self.school_a,
            first_name='Jane',
            last_name='Doe',
            full_name='Jane Doe',
            tsc_number='TSC1001',
            gender='F',
            date_of_birth=date(1990, 1, 1),
            phone='0712345678',
            email='jane.doe@example.com',
        )

    @patch('apps.users.services.AccountService._send_branded_welcome_email')
    @patch('apps.users.services.AccountService._sync_supabase_user')
    def test_cross_school_enable_login_is_denied(self, _sync_mock, _mail_mock):
        with self.assertRaises(PermissionError):
            AccountService.provision_account(
                caller=self.school_b_admin,
                email='jane.doe@example.com',
                role='teacher',
                entity_type=LinkedEntityType.TEACHER,
                entity_id=self.teacher_a.id,
                login_enabled=True,
            )


class EnableLoginViewTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.school = School.objects.create(name='Main School', code='SCHM001')
        self.admin = User.objects.create_user(
            username='main-admin',
            email='main.admin@example.com',
            password='password123',
            role='schooladmin',
            school=self.school,
            login_enabled=True,
            status='ACTIVE',
            is_active=True,
        )

    @patch('apps.users.views.AccountService.provision_account')
    def test_returns_409_when_entity_already_linked(self, mock_provision):
        mock_provision.side_effect = ValueError(AccountService.ENTITY_ALREADY_LINKED_ERROR)

        request = self.factory.post(
            '/api/users/enable-login/',
            {
                'entity_type': LinkedEntityType.TEACHER,
                'entity_id': 35,
                'email': 'teacher35@example.com',
            },
            format='json',
        )
        force_authenticate(request, user=self.admin)
        response = EnableLoginView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('already has a linked user account', response.data['detail'])


class LastSchoolAdminProtectionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.school = School.objects.create(name='Lockout School', code='SCHL001')
        self.platform_admin = User.objects.create_user(
            username='platform-admin',
            email='platform.admin@example.com',
            password='password123',
            role='platform_admin',
            is_staff=True,
            is_superuser=True,
            login_enabled=True,
            status='ACTIVE',
            is_active=True,
        )
        self.admin = User.objects.create_user(
            username='only-admin',
            email='only.admin@example.com',
            password='password123',
            role='schooladmin',
            school=self.school,
            login_enabled=True,
            status='ACTIVE',
            is_active=True,
        )

    def test_cannot_delete_last_school_admin(self):
        request = self.factory.delete(f'/api/users/{self.admin.id}/')
        force_authenticate(request, user=self.platform_admin)
        response = UserDeleteView.as_view()(request, user_id=self.admin.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('last active school administrator', response.data['detail'])
