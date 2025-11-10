from django.urls import reverse
from rest_framework import status
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from django.urls import reverse
from rest_framework import status
from apps.students.models import Student
from apps.users.models import User
from apps.schools.models import School
from datetime import datetime
import logging

class BiometricAttendanceAPITest(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(name='Test School')
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
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Created student with id: {self.student.id}")
        self.url = reverse('biometric_attendance')

    def test_check_in(self):
        """
        Ensure we can create a new attendance record (check-in).
        """
        timestamp = datetime.now().isoformat()
        data = {'student_id': self.student.id, 'timestamp': timestamp}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Attendance recorded successfully')

    def test_check_out(self):
        """
        Ensure we can update an existing attendance record (check-out).
        """
        # First, check in the student
        timestamp_in = datetime.now().isoformat()
        data_in = {'student_id': self.student.id, 'timestamp': timestamp_in}
        self.client.post(self.url, data_in, format='json')

        # Then, check out the student
        timestamp_out = datetime.now().isoformat()
        data_out = {'student_id': self.student.id, 'timestamp': timestamp_out}
        response = self.client.post(self.url, data_out, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_missing_student_id(self):
        """
        Test error response when student_id is missing.
        """
        timestamp = datetime.now().isoformat()
        data = {'timestamp': timestamp}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_timestamp(self):
        """
        Test error response when timestamp is invalid.
        """
        data = {'student_id': self.student.id, 'timestamp': 'invalid-timestamp'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
