import csv
import logging
from datetime import date, datetime, timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.students.models import Student

from .models import (
    Attendance,
    AttendanceSMSLog,
    BiometricAttendanceLog,
    BiometricDevice,
    DeviceConnectionStatus,
)
from .services import (
    build_attendance_report,
    get_or_create_attendance_configuration,
    mark_absent_students,
    process_biometric_scan,
    test_device_connection,
)


logger = logging.getLogger(__name__)


def _request_school(request):
    return getattr(request, 'current_school', None) or getattr(request.user, 'school', None)


def _serialize_configuration(configuration):
    return {
        'biometric_enabled': configuration.biometric_enabled,
        'attendance_mode': configuration.attendance_mode,
        'check_in_cutoff_time': configuration.check_in_cutoff_time.strftime('%H:%M:%S'),
        'absence_mark_time': configuration.absence_mark_time.strftime('%H:%M:%S'),
        'check_out_start_time': configuration.check_out_start_time.strftime('%H:%M:%S'),
        'duplicate_scan_window_seconds': configuration.duplicate_scan_window_seconds,
        'minimum_checkout_gap_minutes': configuration.minimum_checkout_gap_minutes,
        'auto_mark_absent': configuration.auto_mark_absent,
        'sms_enabled': configuration.sms_enabled,
        'send_check_in_sms': configuration.send_check_in_sms,
        'send_check_out_sms': configuration.send_check_out_sms,
        'send_absence_sms': configuration.send_absence_sms,
        'sms_provider_name': configuration.sms_provider_name,
        'sms_api_url': configuration.sms_api_url,
        'sms_api_key': configuration.sms_api_key,
        'sms_sender_id': configuration.sms_sender_id,
        'check_in_template': configuration.check_in_template,
        'check_out_template': configuration.check_out_template,
        'absence_template': configuration.absence_template,
    }


def _serialize_device(device):
    return {
        'id': device.id,
        'device_name': device.device_name,
        'device_ip': device.device_ip,
        'device_port': device.device_port,
        'location': device.location,
        'device_type': device.device_type,
        'external_device_id': device.external_device_id,
        'api_key': device.api_key,
        'is_active': device.is_active,
        'connection_status': device.connection_status,
        'last_seen_at': device.last_seen_at,
        'notes': device.notes,
        'metadata': device.metadata,
    }


def _serialize_log(log):
    return {
        'id': log.id,
        'student_id': log.student_id,
        'student_name': getattr(log.student, 'full_name', None),
        'device_id': log.device_id,
        'device_name': getattr(log.device, 'device_name', None),
        'identifier': log.identifier,
        'scanned_at': log.scanned_at,
        'event_type': log.event_type,
        'processing_status': log.processing_status,
        'is_late': log.is_late,
        'message': log.message,
    }


def _device_from_request(request):
    api_key = request.headers.get('X-Device-API-Key') or request.data.get('api_key')
    if not api_key:
        return None
    return BiometricDevice._base_manager.filter(api_key=api_key, is_active=True).first()


class BiometricSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        configuration = get_or_create_attendance_configuration(_request_school(request))
        return Response(_serialize_configuration(configuration))

    def put(self, request, *args, **kwargs):
        configuration = get_or_create_attendance_configuration(_request_school(request))
        updatable_fields = {
            'biometric_enabled',
            'attendance_mode',
            'duplicate_scan_window_seconds',
            'minimum_checkout_gap_minutes',
            'auto_mark_absent',
            'sms_enabled',
            'send_check_in_sms',
            'send_check_out_sms',
            'send_absence_sms',
            'sms_provider_name',
            'sms_api_url',
            'sms_api_key',
            'sms_sender_id',
            'check_in_template',
            'check_out_template',
            'absence_template',
        }
        time_fields = {'check_in_cutoff_time', 'absence_mark_time', 'check_out_start_time'}
        for field in updatable_fields:
            if field in request.data:
                setattr(configuration, field, request.data.get(field))
        for field in time_fields:
            if request.data.get(field):
                setattr(configuration, field, datetime.strptime(request.data[field], '%H:%M:%S').time())
        configuration.save()
        return Response(_serialize_configuration(configuration))


class BiometricDeviceListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school = _request_school(request)
        devices = BiometricDevice._base_manager.filter(school=school).order_by('location', 'device_name')
        return Response([_serialize_device(device) for device in devices])

    def post(self, request, *args, **kwargs):
        school = _request_school(request)
        required_fields = ['device_name', 'device_ip', 'location']
        missing = [field for field in required_fields if not request.data.get(field)]
        if missing:
            return Response({'error': f'Missing required fields: {", ".join(missing)}'}, status=status.HTTP_400_BAD_REQUEST)
        device = BiometricDevice._base_manager.create(
            school=school,
            device_name=request.data['device_name'],
            device_ip=request.data['device_ip'],
            device_port=request.data.get('device_port') or 4370,
            location=request.data['location'],
            device_type=request.data.get('device_type') or 'general',
            external_device_id=request.data.get('external_device_id', ''),
            is_active=request.data.get('is_active', True),
            notes=request.data.get('notes', ''),
        )
        return Response(_serialize_device(device), status=status.HTTP_201_CREATED)


class BiometricDeviceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, device_id, *args, **kwargs):
        school = _request_school(request)
        device = BiometricDevice._base_manager.filter(school=school, id=device_id).first()
        if device is None:
            return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['device_name', 'device_ip', 'device_port', 'location', 'device_type', 'external_device_id', 'is_active', 'notes']:
            if field in request.data:
                setattr(device, field, request.data.get(field))
        device.save()
        return Response(_serialize_device(device))

    def delete(self, request, device_id, *args, **kwargs):
        school = _request_school(request)
        deleted, _ = BiometricDevice._base_manager.filter(school=school, id=device_id).delete()
        if not deleted:
            return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BiometricDeviceConnectionTestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        school = _request_school(request)
        device = None
        if request.data.get('device_id'):
            device = BiometricDevice._base_manager.filter(school=school, id=request.data.get('device_id')).first()
        host = request.data.get('device_ip') or (device.device_ip if device else None)
        port = int(request.data.get('device_port') or (device.device_port if device else 4370))
        if not host:
            return Response({'error': 'device_ip is required'}, status=status.HTTP_400_BAD_REQUEST)
        result = test_device_connection(host=host, port=port)
        if device is not None:
            device.connection_status = DeviceConnectionStatus.ONLINE if result['success'] else DeviceConnectionStatus.ERROR
            device.last_seen_at = timezone.now() if result['success'] else device.last_seen_at
            device.save(update_fields=['connection_status', 'last_seen_at', 'updated_at'])
        return Response(result, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)


class BiometricLogListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school = _request_school(request)
        limit = min(int(request.query_params.get('limit', 50)), 200)
        logs = BiometricAttendanceLog._base_manager.filter(school=school).select_related('student', 'device')[:limit]
        sms_logs = AttendanceSMSLog._base_manager.filter(school=school).select_related('student')[:limit]
        return Response({
            'logs': [_serialize_log(log) for log in logs],
            'sms_logs': [
                {
                    'id': log.id,
                    'student_name': getattr(log.student, 'full_name', None),
                    'recipient_phone': log.recipient_phone,
                    'event_type': log.event_type,
                    'delivery_status': log.delivery_status,
                    'message': log.message,
                    'sent_at': log.sent_at,
                }
                for log in sms_logs
            ],
        })


class BiometricReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school = _request_school(request)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        today = timezone.localdate()
        parsed_start = datetime.strptime(start_date, '%Y-%m-%d').date() if start_date else today - timedelta(days=30)
        parsed_end = datetime.strptime(end_date, '%Y-%m-%d').date() if end_date else today
        report = build_attendance_report(
            school=school,
            start_date=parsed_start,
            end_date=parsed_end,
            class_id=request.query_params.get('class_id'),
            stream_id=request.query_params.get('stream_id'),
            student_id=request.query_params.get('student_id'),
        )
        return Response(report)


class AttendanceExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school = _request_school(request)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        today = timezone.localdate()
        parsed_start = datetime.strptime(start_date, '%Y-%m-%d').date() if start_date else today - timedelta(days=30)
        parsed_end = datetime.strptime(end_date, '%Y-%m-%d').date() if end_date else today
        report = build_attendance_report(school=school, start_date=parsed_start, end_date=parsed_end)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="attendance-{parsed_start}-{parsed_end}.csv"'
        writer = csv.writer(response)
        writer.writerow(['Student', 'Date', 'Status', 'Time In', 'Time Out', 'Check In Device', 'Check Out Device'])
        for row in report['student_history']:
            writer.writerow([
                row['student__full_name'],
                row['date'],
                row['status'],
                row['time_in'],
                row['time_out'],
                row['check_in_device__device_name'],
                row['check_out_device__device_name'],
            ])
        return response


class AttendanceAbsenceMarkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        school = _request_school(request)
        target_date = request.data.get('date')
        parsed_date = datetime.strptime(target_date, '%Y-%m-%d').date() if target_date else None
        try:
            created_records = mark_absent_students(school=school, target_date=parsed_date)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'created_count': len(created_records)}, status=status.HTTP_200_OK)


class BiometricAttendanceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        device = _device_from_request(request)
        school = device.school if device is not None else _request_school(request)
        if school is None:
            return Response({'error': 'Authentication or device API key is required'}, status=status.HTTP_401_UNAUTHORIZED)

        configuration = get_or_create_attendance_configuration(school)
        if not configuration.biometric_enabled and not getattr(request.user, 'is_authenticated', False):
            return Response({'error': 'Biometric integration is disabled for this school'}, status=status.HTTP_400_BAD_REQUEST)

        payload = dict(request.data)
        try:
            result = process_biometric_scan(school=school, payload=payload, device=device)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if device is not None:
            device.connection_status = DeviceConnectionStatus.ONLINE
            device.last_seen_at = timezone.now()
            device.save(update_fields=['connection_status', 'last_seen_at', 'updated_at'])

        response_data = {
            'message': result.message,
            'event_type': result.event_type,
            'duplicate': result.duplicate,
            'attendance': None,
        }
        if result.attendance is not None:
            response_data['attendance'] = {
                'id': result.attendance.id,
                'date': result.attendance.date,
                'status': result.attendance.status,
                'time_in': result.attendance.time_in,
                'time_out': result.attendance.time_out,
            }
        return Response(response_data, status=result.status_code)


class AttendanceDatasheetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        school = _request_school(request)
        class_id = request.query_params.get('class_id')
        stream_id = request.query_params.get('stream_id')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if not start_date_str:
            start_date = date.today() - timedelta(days=date.today().weekday())
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()

        if not end_date_str:
            end_date = start_date + timedelta(days=6)
        else:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        students = Student._base_manager.filter(school=school, is_active=True)
        if class_id:
            students = students.filter(current_class_id=class_id)
        if stream_id:
            students = students.filter(current_stream_id=stream_id)

        attendance_records = Attendance._base_manager.filter(
            school=school,
            student__in=students,
            date__range=[start_date, end_date],
        ).select_related('student')

        attendance_data = {}
        for record in attendance_records:
            attendance_data.setdefault(record.student_id, {})[record.date] = record.status

        dates = [start_date + timedelta(days=index) for index in range((end_date - start_date).days + 1)]
        response_data = {'dates': [item.strftime('%Y-%m-%d') for item in dates], 'students': []}

        for student in students:
            student_data = {'id': student.id, 'full_name': student.full_name, 'attendance': []}
            for current_date in dates:
                status_value = attendance_data.get(student.id, {}).get(current_date, 'absent')
                student_data['attendance'].append(status_value)
            response_data['students'].append(student_data)

        return Response(response_data)
