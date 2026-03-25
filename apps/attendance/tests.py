from datetime import datetime

from django.urls import reverse
from django.utils import timezone
from apps.students.models import Student
from apps.users.models import User
from apps.schools.models import School
from apps.core.middleware import _request_local
from rest_framework import status
from rest_framework.test import APIClient, APITransactionTestCase

from .models import Attendance, AttendanceStatus

class BiometricAttendanceAPITest(APITransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(name='Test School')
        _request_local.school = self.school
        self.user = User.objects.create_user(username='test@example.com', email='test@example.com', password='password', school=self.school)
        self.client.force_authenticate(user=self.user)
        self.student = Student.objects.create(
            full_name='Test Student',
            gender='M',
            date_of_birth='2010-01-01',
            guardian_name='Test Guardian',
            guardian_phone='+254712345678',
            level='PP1',
            school=self.school
        )
        self.url = reverse('biometric_attendance')

    def _timestamp(self, hour, minute):
        return timezone.make_aware(datetime(2026, 3, 25, hour, minute)).isoformat()

    def tearDown(self):
        # Clean up the thread-local school variable
        del _request_local.school

    def test_check_in(self):
        timestamp = self._timestamp(7, 30)
        data = {'student_id': self.student.id, 'timestamp': timestamp}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Check-in processed')
        self.assertEqual(response.data['event_type'], 'check_in')

        attendance = Attendance.objects.get(student=self.student, date='2026-03-25')
        self.assertEqual(attendance.status, AttendanceStatus.PRESENT)
        self.assertIsNotNone(attendance.time_in)

    def test_check_out(self):
        timestamp_in = self._timestamp(7, 30)
        data_in = {'student_id': self.student.id, 'timestamp': timestamp_in}
        self.client.post(self.url, data_in, format='json')

        timestamp_out = self._timestamp(16, 0)
        data_out = {'student_id': self.student.id, 'timestamp': timestamp_out}
        response = self.client.post(self.url, data_out, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Check-out processed')
        self.assertEqual(response.data['event_type'], 'check_out')

        attendance = Attendance.objects.get(student=self.student, date='2026-03-25')
        self.assertIsNotNone(attendance.time_out)

    def test_duplicate_scan_is_ignored(self):
        timestamp = self._timestamp(7, 30)
        duplicate_timestamp = self._timestamp(7, 31)

        self.client.post(self.url, {'student_id': self.student.id, 'timestamp': timestamp}, format='json')
        response = self.client.post(self.url, {'student_id': self.student.id, 'timestamp': duplicate_timestamp}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['duplicate'])
        self.assertEqual(response.data['event_type'], 'duplicate')

    def test_missing_student_id(self):
        timestamp = self._timestamp(7, 30)
        data = {'timestamp': timestamp}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'student_id, admission_number, or identifier is required')

    def test_invalid_timestamp(self):
        data = {'student_id': self.student.id, 'timestamp': 'invalid-timestamp'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
