from django.urls import path
from .views import BiometricAttendanceView, AttendanceDatasheetView

urlpatterns = [
    path('biometric/', BiometricAttendanceView.as_view(), name='biometric_attendance'),
    path('datasheet/', AttendanceDatasheetView.as_view(), name='attendance_datasheet'),
]
