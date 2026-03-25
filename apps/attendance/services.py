import socket
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.students.models import Student

from .models import (
    Attendance,
    AttendanceEventType,
    AttendanceMode,
    AttendanceSMSLog,
    AttendanceSource,
    AttendanceStatus,
    BiometricAttendanceLog,
    BiometricDevice,
    DeviceConnectionStatus,
    DeviceType,
    LogProcessingStatus,
    SMSDeliveryStatus,
    SchoolAttendanceConfiguration,
)


@dataclass
class ScanProcessingResult:
    status_code: int
    created: bool
    duplicate: bool
    message: str
    event_type: str
    attendance: Attendance | None
    raw_log: BiometricAttendanceLog | None


def get_sms_provider_details(configuration):
    school_provider_configured = bool(configuration.sms_api_url and configuration.sms_api_key)
    system_provider_configured = bool(
        getattr(settings, 'ATTENDANCE_SMS_DEFAULT_API_URL', '')
        and getattr(settings, 'ATTENDANCE_SMS_DEFAULT_API_KEY', '')
    )

    if school_provider_configured:
        return {
            'scope': 'school',
            'provider_name': configuration.sms_provider_name or 'School SMS Provider',
            'api_url': configuration.sms_api_url,
            'api_key': configuration.sms_api_key,
            'sender_id': configuration.sms_sender_id,
            'ready': True,
        }

    if system_provider_configured:
        return {
            'scope': 'system',
            'provider_name': getattr(settings, 'ATTENDANCE_SMS_DEFAULT_PROVIDER_NAME', '') or 'Platform SMS Provider',
            'api_url': getattr(settings, 'ATTENDANCE_SMS_DEFAULT_API_URL', ''),
            'api_key': getattr(settings, 'ATTENDANCE_SMS_DEFAULT_API_KEY', ''),
            'sender_id': getattr(settings, 'ATTENDANCE_SMS_DEFAULT_SENDER_ID', ''),
            'ready': True,
        }

    return {
        'scope': 'unconfigured',
        'provider_name': configuration.sms_provider_name or '',
        'api_url': configuration.sms_api_url,
        'api_key': configuration.sms_api_key,
        'sender_id': configuration.sms_sender_id,
        'ready': False,
    }


def get_or_create_attendance_configuration(school):
    return SchoolAttendanceConfiguration.objects.get_or_create(
        school=school,
        defaults={
            'biometric_enabled': False,
            'attendance_mode': AttendanceMode.DAY,
        },
    )[0]


def resolve_student_for_scan(*, school, payload: dict[str, Any]) -> Student | None:
    student_id = payload.get('student_id')
    admission_number = payload.get('admission_number') or payload.get('identifier')

    queryset = Student._base_manager.filter(school=school, is_active=True)
    if student_id:
        return queryset.filter(id=student_id).first()
    if admission_number:
        return queryset.filter(admission_number=admission_number).first()
    return None


def _render_sms_template(template: str, *, student: Student, attendance_date: date, timestamp: datetime):
    return template.format(
        student_name=student.full_name,
        admission_number=student.admission_number,
        guardian_name=student.guardian_name,
        date=attendance_date.strftime('%Y-%m-%d'),
        time=timestamp.strftime('%I:%M %p'),
    )


def send_attendance_sms(*, configuration, student, event_type, attendance_record=None, biometric_log=None, timestamp=None):
    timestamp = timestamp or timezone.now()
    recipient_phone = student.guardian_phone or ''
    provider = get_sms_provider_details(configuration)
    template_map = {
        AttendanceEventType.CHECK_IN: configuration.check_in_template,
        AttendanceEventType.LATE: configuration.check_in_template,
        AttendanceEventType.CHECK_OUT: configuration.check_out_template,
        AttendanceEventType.ABSENT: configuration.absence_template,
    }
    template = template_map.get(event_type)
    if not template or not recipient_phone:
        return AttendanceSMSLog._base_manager.create(
            school=student.school,
            student=student,
            attendance_record=attendance_record,
            biometric_log=biometric_log,
            event_type=event_type,
            recipient_phone=recipient_phone,
            message='',
            delivery_status=SMSDeliveryStatus.SKIPPED,
            provider_response={'reason': 'missing_template_or_phone', 'provider_scope': provider['scope']},
        )

    message = _render_sms_template(template, student=student, attendance_date=timestamp.date(), timestamp=timestamp)

    sms_log = AttendanceSMSLog._base_manager.create(
        school=student.school,
        student=student,
        attendance_record=attendance_record,
        biometric_log=biometric_log,
        event_type=event_type,
        recipient_phone=recipient_phone,
        message=message,
        delivery_status=SMSDeliveryStatus.PENDING,
    )

    if not configuration.sms_enabled:
        sms_log.delivery_status = SMSDeliveryStatus.SKIPPED
        sms_log.provider_response = {'reason': 'sms_disabled', 'provider_scope': provider['scope']}
        sms_log.save(update_fields=['delivery_status', 'provider_response', 'updated_at'])
        return sms_log

    if not provider['ready']:
        sms_log.delivery_status = SMSDeliveryStatus.SKIPPED
        sms_log.provider_response = {'reason': 'sms_provider_not_configured', 'provider_scope': provider['scope']}
        sms_log.save(update_fields=['delivery_status', 'provider_response', 'updated_at'])
        return sms_log

    try:
        response = requests.post(
            provider['api_url'],
            json={
                'to': recipient_phone,
                'message': message,
                'sender_id': provider['sender_id'],
            },
            headers={
                'Authorization': f"Bearer {provider['api_key']}",
                'Content-Type': 'application/json',
            },
            timeout=10,
        )
        response.raise_for_status()
        sms_log.delivery_status = SMSDeliveryStatus.SENT
        sms_log.provider_response = {
            'status_code': response.status_code,
            'body': response.text[:1000],
            'provider_scope': provider['scope'],
            'provider_name': provider['provider_name'],
        }
        sms_log.sent_at = timezone.now()
    except Exception as exc:
        sms_log.delivery_status = SMSDeliveryStatus.FAILED
        sms_log.provider_response = {
            'error': str(exc),
            'provider_scope': provider['scope'],
            'provider_name': provider['provider_name'],
        }

    sms_log.save(update_fields=['delivery_status', 'provider_response', 'sent_at', 'updated_at'])
    return sms_log


def test_device_connection(*, host: str, port: int, timeout: float = 3.0):
    started_at = timezone.now()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            latency_ms = max(1, int((timezone.now() - started_at).total_seconds() * 1000))
            return {'success': True, 'message': 'Connection successful', 'latency_ms': latency_ms}
    except OSError as exc:
        return {'success': False, 'message': str(exc), 'latency_ms': None}


def _duplicate_window(configuration):
    return timedelta(seconds=configuration.duplicate_scan_window_seconds)


def _minimum_checkout_gap(configuration):
    return timedelta(minutes=configuration.minimum_checkout_gap_minutes)


def _scan_datetime(payload: dict[str, Any]) -> datetime:
    timestamp = payload.get('timestamp')
    if not timestamp:
        raise ValueError('timestamp is required')
    parsed = datetime.fromisoformat(timestamp)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _find_duplicate_log(*, school, student, device, scanned_at, configuration):
    lower_bound = scanned_at - _duplicate_window(configuration)
    queryset = BiometricAttendanceLog._base_manager.filter(
        school=school,
        student=student,
        scanned_at__gte=lower_bound,
        scanned_at__lte=scanned_at,
        processing_status__in=[LogProcessingStatus.PROCESSED, LogProcessingStatus.DUPLICATE],
    )
    if device is not None:
        queryset = queryset.filter(device=device)
    return queryset.order_by('-scanned_at', '-id').first()


def _build_log(*, school, student, device, payload, scanned_at, status, event_type, message, duplicate_of=None, attendance_record=None, is_late=False):
    return BiometricAttendanceLog._base_manager.create(
        school=school,
        student=student,
        device=device,
        attendance_record=attendance_record,
        identifier=str(payload.get('identifier') or payload.get('admission_number') or payload.get('student_id') or ''),
        scanned_at=scanned_at,
        processing_status=status,
        event_type=event_type,
        message=message,
        duplicate_of=duplicate_of,
        raw_payload=payload,
        is_late=is_late,
    )


def _determine_general_device_event(*, attendance_record, scanned_at, configuration):
    if attendance_record.time_in is None:
        return AttendanceEventType.CHECK_IN
    if attendance_record.time_out is None:
        time_in_dt = timezone.make_aware(datetime.combine(scanned_at.date(), attendance_record.time_in))
        if scanned_at - time_in_dt >= _minimum_checkout_gap(configuration) or scanned_at.time() >= configuration.check_out_start_time:
            return AttendanceEventType.CHECK_OUT
    return AttendanceEventType.DUPLICATE


def process_biometric_scan(*, school, payload: dict[str, Any], device: BiometricDevice | None = None):
    configuration = get_or_create_attendance_configuration(school)
    scanned_at = _scan_datetime(payload)
    if not any(payload.get(key) for key in ['student_id', 'admission_number', 'identifier']):
        raise ValueError('student_id, admission_number, or identifier is required')
    student = resolve_student_for_scan(school=school, payload=payload)
    if student is None:
        raw_log = _build_log(
            school=school,
            student=None,
            device=device,
            payload=payload,
            scanned_at=scanned_at,
            status=LogProcessingStatus.REJECTED,
            event_type=AttendanceEventType.UNKNOWN,
            message='Student not found',
        )
        return ScanProcessingResult(404, False, False, 'Student not found', AttendanceEventType.UNKNOWN, None, raw_log)

    duplicate_log = _find_duplicate_log(
        school=school,
        student=student,
        device=device,
        scanned_at=scanned_at,
        configuration=configuration,
    )
    if duplicate_log is not None:
        raw_log = _build_log(
            school=school,
            student=student,
            device=device,
            payload=payload,
            scanned_at=scanned_at,
            status=LogProcessingStatus.DUPLICATE,
            event_type=AttendanceEventType.DUPLICATE,
            message='Duplicate scan ignored',
            duplicate_of=duplicate_log,
        )
        return ScanProcessingResult(200, False, True, 'Duplicate scan ignored', AttendanceEventType.DUPLICATE, duplicate_log.attendance_record, raw_log)

    with transaction.atomic():
        attendance_record, created = Attendance._base_manager.get_or_create(
            school=school,
            student=student,
            date=scanned_at.date(),
            defaults={
                'source': AttendanceSource.BIOMETRIC,
                'status': AttendanceStatus.PRESENT,
            },
        )

        if device is not None and device.device_type != DeviceType.GENERAL:
            event_type = AttendanceEventType.CHECK_IN if device.device_type == DeviceType.CHECK_IN else AttendanceEventType.CHECK_OUT
        else:
            event_type = _determine_general_device_event(
                attendance_record=attendance_record,
                scanned_at=scanned_at,
                configuration=configuration,
            )

        is_late = False
        if event_type == AttendanceEventType.CHECK_IN:
            attendance_record.time_in = scanned_at.time()
            attendance_record.check_in_device = device
            attendance_record.source = AttendanceSource.BIOMETRIC
            if scanned_at.time() > configuration.check_in_cutoff_time:
                attendance_record.status = AttendanceStatus.LATE
                is_late = True
                effective_event_type = AttendanceEventType.LATE
                message = 'Late check-in processed'
            else:
                attendance_record.status = AttendanceStatus.PRESENT
                effective_event_type = AttendanceEventType.CHECK_IN
                message = 'Check-in processed'
            attendance_record.notes = (attendance_record.notes or '').strip()
            attendance_record.save(update_fields=['time_in', 'check_in_device', 'source', 'status', 'notes', 'updated_at'])
        elif event_type == AttendanceEventType.CHECK_OUT:
            attendance_record.time_out = scanned_at.time()
            attendance_record.check_out_device = device
            if attendance_record.time_in is None:
                attendance_record.notes = 'Checkout received without prior check-in.'
            attendance_record.source = AttendanceSource.BIOMETRIC
            if attendance_record.status == AttendanceStatus.ABSENT:
                attendance_record.status = AttendanceStatus.PRESENT
            attendance_record.save(update_fields=['time_out', 'check_out_device', 'source', 'status', 'notes', 'updated_at'])
            effective_event_type = AttendanceEventType.CHECK_OUT
            message = 'Check-out processed'
        else:
            raw_log = _build_log(
                school=school,
                student=student,
                device=device,
                payload=payload,
                scanned_at=scanned_at,
                status=LogProcessingStatus.DUPLICATE,
                event_type=AttendanceEventType.DUPLICATE,
                message='Scan ignored because it does not qualify as a checkout yet',
                attendance_record=attendance_record,
            )
            return ScanProcessingResult(200, False, True, 'Scan ignored because it does not qualify as a checkout yet', AttendanceEventType.DUPLICATE, attendance_record, raw_log)

        raw_log = _build_log(
            school=school,
            student=student,
            device=device,
            payload=payload,
            scanned_at=scanned_at,
            status=LogProcessingStatus.PROCESSED,
            event_type=effective_event_type,
            message=message,
            attendance_record=attendance_record,
            is_late=is_late,
        )

        should_send_sms = (
            (effective_event_type in [AttendanceEventType.CHECK_IN, AttendanceEventType.LATE] and configuration.send_check_in_sms)
            or (effective_event_type == AttendanceEventType.CHECK_OUT and configuration.send_check_out_sms)
        )
        if should_send_sms:
            send_attendance_sms(
                configuration=configuration,
                student=student,
                event_type=effective_event_type if effective_event_type != AttendanceEventType.LATE else AttendanceEventType.CHECK_IN,
                attendance_record=attendance_record,
                biometric_log=raw_log,
                timestamp=scanned_at,
            )

    return ScanProcessingResult(201 if created else 200, created, False, message, effective_event_type, attendance_record, raw_log)


def mark_absent_students(*, school, target_date: date | None = None):
    configuration = get_or_create_attendance_configuration(school)
    target_date = target_date or timezone.localdate()

    if target_date == timezone.localdate() and timezone.localtime().time() < configuration.absence_mark_time:
        raise ValueError('Absence cutoff time has not been reached yet')

    existing_student_ids = set(
        Attendance._base_manager.filter(school=school, date=target_date).values_list('student_id', flat=True)
    )
    students = list(Student._base_manager.filter(school=school, is_active=True).exclude(id__in=existing_student_ids))
    created_records = []

    for student in students:
        created_records.append(
            Attendance._base_manager.create(
                school=school,
                student=student,
                date=target_date,
                status=AttendanceStatus.ABSENT,
                source=AttendanceSource.BIOMETRIC,
                notes='Automatically marked absent after biometric cutoff.',
            )
        )

    if configuration.send_absence_sms:
        absence_timestamp = timezone.make_aware(datetime.combine(target_date, configuration.absence_mark_time))
        for record in created_records:
            send_attendance_sms(
                configuration=configuration,
                student=record.student,
                event_type=AttendanceEventType.ABSENT,
                attendance_record=record,
                timestamp=absence_timestamp,
            )

    return created_records


def build_attendance_report(*, school, start_date: date, end_date: date, class_id: int | None = None, stream_id: int | None = None, student_id: int | None = None):
    queryset = Attendance._base_manager.filter(school=school, date__range=[start_date, end_date]).select_related('student', 'check_in_device', 'check_out_device')
    if class_id:
        queryset = queryset.filter(student__current_class_id=class_id)
    if stream_id:
        queryset = queryset.filter(student__current_stream_id=stream_id)
    if student_id:
        queryset = queryset.filter(student_id=student_id)

    totals = queryset.aggregate(
        total=Count('id'),
        present=Count('id', filter=Q(status=AttendanceStatus.PRESENT)),
        late=Count('id', filter=Q(status=AttendanceStatus.LATE)),
        absent=Count('id', filter=Q(status=AttendanceStatus.ABSENT)),
        excused=Count('id', filter=Q(status=AttendanceStatus.EXCUSED)),
        missing_checkout=Count('id', filter=Q(time_in__isnull=False, time_out__isnull=True)),
    )

    daily = list(
        queryset.values('date', 'status')
        .order_by('date')
        .annotate(count=Count('id'))
    )
    late_arrivals = list(
        queryset.filter(status=AttendanceStatus.LATE)
        .values('student_id', 'student__full_name', 'date', 'time_in')
        .order_by('-date', 'time_in')[:100]
    )
    student_history = list(
        queryset.values(
            'student_id',
            'student__full_name',
            'date',
            'status',
            'time_in',
            'time_out',
            'check_in_device__device_name',
            'check_out_device__device_name',
        ).order_by('-date', 'student__full_name')[:500]
    )

    return {
        'summary': totals,
        'daily_breakdown': daily,
        'late_arrivals': late_arrivals,
        'student_history': student_history,
    }