from datetime import date
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.users.models import User
from apps.users.services import AccountService
from apps.users.views import EnableLoginView, UserListView


class AccountServiceTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School', code='SCH555')
        self.platform_admin = User.objects.create_user(
            username='platform-admin',
            email='admin@platform.com',
            password='password123',
            role='platform_admin',
            is_staff=True
        )
        self.school_admin = User.objects.create_user(
            username='school-admin',
            email='admin@school.com',
            password='password123',
            role='schooladmin',
            school=self.school,
            is_active=True,
            login_enabled=True
        )
        self.teacher = Teacher.objects.create(
            school=self.school,
            first_name='Jane',
            last_name='Doe',
            full_name='Jane Doe',
            email='jane.doe@example.com'
        )

    @patch('apps.users.services.requests.post')
    @patch('apps.users.services.send_notification')
    @patch('apps.users.services.log_activity')
    def test_provision_school_user_success(self, mock_log, mock_notify, mock_post):
        mock_post.return_value.status_code = 201
        mock_post.return_value.json.return_value = {'id': 'supabase-uuid'}

        user = AccountService.provision_account(
            caller=self.school_admin,
            email='jane.doe@example.com',
            role='staff',
            entity_type='teacher',
            entity_id=self.teacher.id,
            login_enabled=True,
            send_invite=True
        )

        self.assertEqual(user.email, 'jane.doe@example.com')
        self.assertEqual(user.entity_id, self.teacher.id)
        self.assertEqual(user.school, self.school)
        self.assertEqual(user.status, 'INVITED')
        self.assertEqual(str(user.auth_user_id), 'supabase-uuid')
        mock_notify.assert_called_once()
        mock_log.assert_called_once()

    def test_provision_platform_user_by_school_admin_fails(self):
        with self.assertRaises(PermissionError):
            AccountService.provision_account(
                caller=self.school_admin,
                email='new.admin@platform.com',
                role='support'
            )

    @patch('apps.users.services.requests.post')
    def test_provision_platform_user_by_platform_admin_success(self, mock_post):
        mock_post.return_value.status_code = 201
        mock_post.return_value.json.return_value = {'id': 'supabase-uuid-2'}

        user = AccountService.provision_account(
            caller=self.platform_admin,
            email='new.admin@platform.com',
            role='support'
        )

        self.assertEqual(user.email, 'new.admin@platform.com')
        self.assertIsNone(user.school)
        self.assertEqual(user.role, 'support')
        self.assertTrue(user.is_staff)

    def test_disable_last_school_admin_fails(self):
        with self.assertRaisesRegex(ValueError, "Cannot disable the last administrator"):
            AccountService.disable_login(user_id=self.school_admin.id, caller=self.platform_admin)


class UserViewIntegrationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.school = School.objects.create(name='Test School', code='SCH555')
        self.platform_admin = User.objects.create_user(
            username='p-admin', email='p@admin.com', role='platform_admin', is_staff=True, is_superuser=True
        )
        self.teacher = Teacher.objects.create(
            school=self.school, first_name='John', last_name='Smith', email='john@school.com'
        )

    @patch('apps.users.services.AccountService.provision_account')
    def test_enable_login_view_calls_service(self, mock_provision):
        mock_provision.return_value = self.platform_admin
        view = EnableLoginView.as_view()
        request = self.factory.post('/api/users/enable-login/', {
            'entity_type': 'teacher',
            'entity_id': self.teacher.id,
            'email': 'john@school.com'
        })
        force_authenticate(request, user=self.platform_admin)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_provision.assert_called_once()

    @patch('apps.users.services.AccountService.provision_account')
    def test_user_list_view_create_calls_service(self, mock_provision):
        mock_provision.return_value = self.platform_admin
        view = UserListView.as_view()
        request = self.factory.post('/api/users/', {
            'email': 'new@platform.com',
            'role': 'support'
        })
        force_authenticate(request, user=self.platform_admin)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_provision.assert_called_once()
