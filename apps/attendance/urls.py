from django.urls import path

from .views import (
    AttendanceAbsenceMarkView,
    AttendanceDatasheetView,
    AttendanceExportView,
    BiometricAttendanceView,
    BiometricDeviceConnectionTestView,
    BiometricDeviceDetailView,
    BiometricDeviceListCreateView,
    BiometricLogListView,
    BiometricReportView,
    BiometricSettingsView,
)

urlpatterns = [
    path('biometric/', BiometricAttendanceView.as_view(), name='biometric_attendance'),
    path('biometric/settings/', BiometricSettingsView.as_view(), name='biometric_settings'),
    path('biometric/devices/', BiometricDeviceListCreateView.as_view(), name='biometric_devices'),
    path('biometric/devices/<int:device_id>/', BiometricDeviceDetailView.as_view(), name='biometric_device_detail'),
    path('biometric/test-connection/', BiometricDeviceConnectionTestView.as_view(), name='biometric_test_connection'),
    path('biometric/logs/', BiometricLogListView.as_view(), name='biometric_logs'),
    path('biometric/reports/', BiometricReportView.as_view(), name='biometric_reports'),
    path('biometric/export/', AttendanceExportView.as_view(), name='biometric_export'),
    path('biometric/mark-absences/', AttendanceAbsenceMarkView.as_view(), name='biometric_mark_absences'),
    path('datasheet/', AttendanceDatasheetView.as_view(), name='attendance_datasheet'),
]
