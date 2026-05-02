from django.contrib import admin

from .models import Attendance, AttendanceSMSLog, BiometricAttendanceLog, BiometricDevice, SchoolAttendanceConfiguration


@admin.register(SchoolAttendanceConfiguration)
class SchoolAttendanceConfigurationAdmin(admin.ModelAdmin):
	list_display = ('school', 'biometric_enabled', 'attendance_mode', 'sms_enabled', 'updated_at')
	search_fields = ('school__name', 'school__code')


@admin.register(BiometricDevice)
class BiometricDeviceAdmin(admin.ModelAdmin):
	list_display = ('device_name', 'school', 'location', 'device_type', 'connection_status', 'is_active', 'last_seen_at')
	list_filter = ('device_type', 'connection_status', 'is_active')
	search_fields = ('device_name', 'location', 'device_ip', 'school__name')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
	list_display = ('student', 'school', 'date', 'status', 'time_in', 'time_out', 'source')
	list_filter = ('status', 'source', 'date')
	search_fields = ('student__full_name', 'student__admission_number', 'school__name')


@admin.register(BiometricAttendanceLog)
class BiometricAttendanceLogAdmin(admin.ModelAdmin):
	list_display = ('student', 'school', 'device', 'scanned_at', 'event_type', 'processing_status', 'is_late')
	list_filter = ('event_type', 'processing_status', 'is_late')
	search_fields = ('student__full_name', 'identifier', 'device__device_name', 'school__name')


@admin.register(AttendanceSMSLog)
class AttendanceSMSLogAdmin(admin.ModelAdmin):
	list_display = ('student', 'school', 'event_type', 'recipient_phone', 'delivery_status', 'sent_at')
	list_filter = ('event_type', 'delivery_status')
	search_fields = ('student__full_name', 'recipient_phone', 'school__name')
