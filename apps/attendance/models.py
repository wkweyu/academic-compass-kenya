import secrets
from datetime import time

from django.db import models
from django.utils import timezone

from apps.core.models import SchoolScopedModel
from apps.schools.models import School
from apps.students.models import Student


class AttendanceStatus(models.TextChoices):
    PRESENT = 'present', 'Present'
    LATE = 'late', 'Late'
    ABSENT = 'absent', 'Absent'
    EXCUSED = 'excused', 'Excused'


class AttendanceSource(models.TextChoices):
    MANUAL = 'manual', 'Manual'
    BIOMETRIC = 'biometric', 'Biometric'
    IMPORT = 'import', 'Import'


class DeviceType(models.TextChoices):
    CHECK_IN = 'check_in', 'Check In'
    CHECK_OUT = 'check_out', 'Check Out'
    GENERAL = 'general', 'General'


class AttendanceMode(models.TextChoices):
    DAY = 'day', 'Day Scholar'
    BOARDING = 'boarding', 'Boarding'
    HYBRID = 'hybrid', 'Hybrid'


class DeviceConnectionStatus(models.TextChoices):
    UNKNOWN = 'unknown', 'Unknown'
    ONLINE = 'online', 'Online'
    OFFLINE = 'offline', 'Offline'
    ERROR = 'error', 'Error'


class LogProcessingStatus(models.TextChoices):
    RECEIVED = 'received', 'Received'
    PROCESSED = 'processed', 'Processed'
    DUPLICATE = 'duplicate', 'Duplicate'
    REJECTED = 'rejected', 'Rejected'


class AttendanceEventType(models.TextChoices):
    CHECK_IN = 'check_in', 'Check In'
    CHECK_OUT = 'check_out', 'Check Out'
    LATE = 'late', 'Late Arrival'
    ABSENT = 'absent', 'Absent'
    DUPLICATE = 'duplicate', 'Duplicate Scan'
    UNKNOWN = 'unknown', 'Unknown'


class SMSDeliveryStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'
    SKIPPED = 'skipped', 'Skipped'


def default_check_in_cutoff_time():
    return time(8, 30)


def default_absence_mark_time():
    return time(9, 0)


def default_check_out_start_time():
    return time(15, 30)


class SchoolAttendanceConfiguration(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='attendance_configuration')
    biometric_enabled = models.BooleanField(default=False)
    attendance_mode = models.CharField(max_length=20, choices=AttendanceMode.choices, default=AttendanceMode.DAY)
    check_in_cutoff_time = models.TimeField(default=default_check_in_cutoff_time)
    absence_mark_time = models.TimeField(default=default_absence_mark_time)
    check_out_start_time = models.TimeField(default=default_check_out_start_time)
    duplicate_scan_window_seconds = models.PositiveIntegerField(default=120)
    minimum_checkout_gap_minutes = models.PositiveIntegerField(default=180)
    auto_mark_absent = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    send_check_in_sms = models.BooleanField(default=True)
    send_check_out_sms = models.BooleanField(default=True)
    send_absence_sms = models.BooleanField(default=True)
    sms_provider_name = models.CharField(max_length=100, blank=True)
    sms_api_url = models.URLField(blank=True)
    sms_api_key = models.CharField(max_length=255, blank=True)
    sms_sender_id = models.CharField(max_length=64, blank=True)
    check_in_template = models.TextField(default='Dear Parent, {student_name} checked in at {time}.')
    check_out_template = models.TextField(default='Dear Parent, {student_name} checked out at {time}.')
    absence_template = models.TextField(default='Dear Parent, {student_name} has been marked absent for {date}.')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_configuration'

    def __str__(self):
        return f'Attendance configuration for {self.school.name}'


class BiometricDevice(SchoolScopedModel):
    device_name = models.CharField(max_length=120)
    device_ip = models.GenericIPAddressField()
    device_port = models.PositiveIntegerField(default=4370)
    location = models.CharField(max_length=120)
    device_type = models.CharField(max_length=20, choices=DeviceType.choices, default=DeviceType.GENERAL)
    external_device_id = models.CharField(max_length=120, blank=True)
    api_key = models.CharField(max_length=64, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    connection_status = models.CharField(max_length=20, choices=DeviceConnectionStatus.choices, default=DeviceConnectionStatus.UNKNOWN)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_biometric_device'
        ordering = ['location', 'device_name']
        constraints = [
            models.UniqueConstraint(fields=['school', 'device_name'], name='attendance_device_school_name_unique'),
        ]

    def save(self, *args, **kwargs):
        if not self.api_key:
            self.api_key = secrets.token_hex(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.device_name} ({self.location})'


class Attendance(SchoolScopedModel):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    date = models.DateField()
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT)
    source = models.CharField(max_length=20, choices=AttendanceSource.choices, default=AttendanceSource.MANUAL)
    check_in_device = models.ForeignKey('BiometricDevice', on_delete=models.SET_NULL, null=True, blank=True, related_name='check_in_records')
    check_out_device = models.ForeignKey('BiometricDevice', on_delete=models.SET_NULL, null=True, blank=True, related_name='check_out_records')
    notes = models.TextField(blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance'
        unique_together = ('student', 'date')
        ordering = ['-date', 'student__full_name']

    def __str__(self):
        return f'{self.student.full_name} - {self.date} ({self.status})'


class BiometricAttendanceLog(SchoolScopedModel):
    device = models.ForeignKey(BiometricDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='biometric_logs')
    attendance_record = models.ForeignKey(Attendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='biometric_logs')
    identifier = models.CharField(max_length=120)
    scanned_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=20, choices=AttendanceEventType.choices, default=AttendanceEventType.UNKNOWN)
    processing_status = models.CharField(max_length=20, choices=LogProcessingStatus.choices, default=LogProcessingStatus.RECEIVED)
    is_late = models.BooleanField(default=False)
    message = models.TextField(blank=True)
    duplicate_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='duplicates')
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_biometric_log'
        ordering = ['-scanned_at', '-id']
        indexes = [
            models.Index(fields=['school', 'scanned_at']),
            models.Index(fields=['school', 'identifier', 'scanned_at']),
        ]


class AttendanceSMSLog(SchoolScopedModel):
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_sms_logs')
    attendance_record = models.ForeignKey(Attendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs')
    biometric_log = models.ForeignKey(BiometricAttendanceLog, on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs')
    event_type = models.CharField(max_length=20, choices=AttendanceEventType.choices)
    recipient_phone = models.CharField(max_length=32)
    message = models.TextField()
    delivery_status = models.CharField(max_length=20, choices=SMSDeliveryStatus.choices, default=SMSDeliveryStatus.PENDING)
    provider_response = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_sms_log'
        ordering = ['-created_at']
