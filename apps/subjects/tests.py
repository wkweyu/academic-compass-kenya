from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from .models import Subject

User = get_user_model()

class SubjectViewTests(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(username='staff', email='staff@example.com', password='password', is_staff=True)
        self.user = User.objects.create_user(username='user', email='user@example.com', password='password')
        self.subject = Subject.objects.create(name='Math', code='MAT')

    def test_subject_list_view(self):
        self.client.login(email='user@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.subject.name)

    def test_subject_detail_view(self):
        self.client.login(email='user@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_detail', args=[self.subject.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.subject.name)

    def test_subject_add_view_staff(self):
        self.client.login(email='staff@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_add'))
        self.assertEqual(response.status_code, 200)

    def test_subject_add_view_non_staff(self):
        self.client.login(email='user@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_add'))
        self.assertEqual(response.status_code, 403)

    def test_subject_edit_view_staff(self):
        self.client.login(email='staff@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_edit', args=[self.subject.pk]))
        self.assertEqual(response.status_code, 200)

    def test_subject_edit_view_non_staff(self):
        self.client.login(email='user@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_edit', args=[self.subject.pk]))
        self.assertEqual(response.status_code, 403)

    def test_subject_delete_view_staff(self):
        self.client.login(email='staff@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_delete', args=[self.subject.pk]))
        self.assertEqual(response.status_code, 200)

    def test_subject_delete_view_non_staff(self):
        self.client.login(email='user@example.com', password='password')
        response = self.client.get(reverse('subjects:subject_delete', args=[self.subject.pk]))
        self.assertEqual(response.status_code, 403)
