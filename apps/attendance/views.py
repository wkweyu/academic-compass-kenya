from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.students.models import Student
from .models import Attendance
from datetime import datetime
from django.conf import settings
from twilio.rest import Client
import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)

class BiometricAttendanceView(APIView):
    def post(self, request, *args, **kwargs):
        student_id = request.data.get('student_id')
        timestamp = request.data.get('timestamp')

        if not student_id or not timestamp:
            return Response(
                {'error': 'student_id and timestamp are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # The .get() method on a manager with a school filter will
            # automatically apply the school of the logged-in user.
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            logger.error(f"Student with id {student_id} not found in the user's school.")
            return Response(
                {'error': 'Student not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            attendance_time = datetime.fromisoformat(timestamp)
        except ValueError:
            return Response(
                {'error': 'Invalid timestamp format. Use ISO 8601 format.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use get_or_create to simplify logic
        attendance, created = Attendance.objects.get_or_create(
            student=student,
            date=attendance_time.date(),
            school=student.school,
            defaults={
                'time_in': attendance_time.time(),
                'status': 'present'
            }
        )

        if not created:
            # If the record already exists, it's a checkout
            attendance.time_out = attendance_time.time()
            attendance.save()

        # Send SMS notification
        try:
            # The actual sending is commented out, and the message is logged instead.
            # client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            if attendance.time_out:
                message_body = f"Dear Parent, your child {student.full_name} has checked out of school at {attendance.time_out.strftime('%H:%M:%S')}."
            else:
                message_body = f"Dear Parent, your child {student.full_name} has checked into school at {attendance.time_in.strftime('%H:%M:%S')}."

            # Log the message instead of sending it
            logger.info("Simulating SMS to guardian:")
            logger.info(f"Recipient: {student.guardian_phone}")
            logger.info(f"Message: {message_body}")

            # To send a real SMS, uncomment the following lines and configure Twilio credentials in settings
            # if student.guardian_phone:
            #     message = client.messages.create(
            #         body=message_body,
            #         from_=settings.TWILIO_PHONE_NUMBER,
            #         to=str(student.guardian_phone)
            #     )
            #     logger.info(f"SMS sent successfully with SID: {message.sid}")
            # else:
            #     logger.warning(f"No guardian phone number for student {student.id}")

        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")


        return Response(
            {'message': 'Attendance recorded successfully'},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

from datetime import date, timedelta
from apps.students.models import Class, Stream

class AttendanceDatasheetView(APIView):
    def get(self, request, *args, **kwargs):
        class_id = request.query_params.get('class_id')
        stream_id = request.query_params.get('stream_id')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Default to the current week
        if not start_date_str:
            start_date = date.today() - timedelta(days=date.today().weekday())
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()

        if not end_date_str:
            end_date = start_date + timedelta(days=6)
        else:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        # Get all students in the selected class and stream
        students = Student.objects.all()
        if class_id:
            students = students.filter(current_class_id=class_id)
        if stream_id:
            students = students.filter(current_stream_id=stream_id)

        # Get all attendance records for the selected students and date range
        attendance_records = Attendance.objects.filter(
            student__in=students,
            date__range=[start_date, end_date]
        ).select_related('student')

        # Create a dictionary to store attendance data by student and date
        attendance_data = {}
        for record in attendance_records:
            if record.student_id not in attendance_data:
                attendance_data[record.student_id] = {}
            attendance_data[record.student_id][record.date] = record.status

        # Create a list of dates in the selected range
        dates = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]

        # Prepare the response data
        response_data = {
            'dates': [d.strftime('%Y-%m-%d') for d in dates],
            'students': []
        }

        for student in students:
            student_data = {
                'id': student.id,
                'full_name': student.full_name,
                'attendance': []
            }
            for d in dates:
                status = attendance_data.get(student.id, {}).get(d, 'absent')
                student_data['attendance'].append(status)
            response_data['students'].append(student_data)

        return Response(response_data)
