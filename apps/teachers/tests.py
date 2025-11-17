
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import User
from apps.schools.models import School
from apps.teachers.models import Teacher
from datetime import date

class TeacherAPITestCase(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School')
        self.user = User.objects.create_user(
            email='testuser@example.com',
            username='testuser',
            first_name='Test',
            last_name='User',
            password='password123',
            school=self.school,
            role='admin'
        )
        self.client.force_authenticate(user=self.user)
        self.teacher_data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'tsc_number': '123456',
            'gender': 'M',
            'date_of_birth': date(1990, 1, 1),
            'phone': '0712345678',
            'email': 'john.doe@example.com',
        }

    def test_create_teacher(self):
        url = reverse('teacher-list')
        response = self.client.post(url, self.teacher_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Teacher.objects.count(), 1)
        teacher = Teacher.objects.get()
        self.assertEqual(teacher.school, self.school)
        self.assertEqual(teacher.full_name, 'John Doe')
