# Generated manually for biometric attendance system support.

import apps.attendance.models
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolAttendanceConfiguration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('biometric_enabled', models.BooleanField(default=False)),
                ('attendance_mode', models.CharField(choices=[('day', 'Day Scholar'), ('boarding', 'Boarding'), ('hybrid', 'Hybrid')], default='day', max_length=20)),
                ('check_in_cutoff_time', models.TimeField(default=apps.attendance.models.default_check_in_cutoff_time)),
                ('absence_mark_time', models.TimeField(default=apps.attendance.models.default_absence_mark_time)),
                ('check_out_start_time', models.TimeField(default=apps.attendance.models.default_check_out_start_time)),
                ('duplicate_scan_window_seconds', models.PositiveIntegerField(default=120)),
                ('minimum_checkout_gap_minutes', models.PositiveIntegerField(default=180)),
                ('auto_mark_absent', models.BooleanField(default=True)),
                ('sms_enabled', models.BooleanField(default=False)),
                ('send_check_in_sms', models.BooleanField(default=True)),
                ('send_check_out_sms', models.BooleanField(default=True)),
                ('send_absence_sms', models.BooleanField(default=True)),
                ('sms_provider_name', models.CharField(blank=True, max_length=100)),
                ('sms_api_url', models.URLField(blank=True)),
                ('sms_api_key', models.CharField(blank=True, max_length=255)),
                ('sms_sender_id', models.CharField(blank=True, max_length=64)),
                ('check_in_template', models.TextField(default='Dear Parent, {student_name} checked in at {time}.')),
                ('check_out_template', models.TextField(default='Dear Parent, {student_name} checked out at {time}.')),
                ('absence_template', models.TextField(default='Dear Parent, {student_name} has been marked absent for {date}.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='attendance_configuration', to='schools.school')),
            ],
            options={'db_table': 'attendance_configuration'},
        ),
        migrations.CreateModel(
            name='BiometricDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_name', models.CharField(max_length=120)),
                ('device_ip', models.GenericIPAddressField()),
                ('device_port', models.PositiveIntegerField(default=4370)),
                ('location', models.CharField(max_length=120)),
                ('device_type', models.CharField(choices=[('check_in', 'Check In'), ('check_out', 'Check Out'), ('general', 'General')], default='general', max_length=20)),
                ('external_device_id', models.CharField(blank=True, max_length=120)),
                ('api_key', models.CharField(blank=True, max_length=64, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('connection_status', models.CharField(choices=[('unknown', 'Unknown'), ('online', 'Online'), ('offline', 'Offline'), ('error', 'Error')], default='unknown', max_length=20)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='schools.school')),
            ],
            options={
                'db_table': 'attendance_biometric_device',
                'ordering': ['location', 'device_name'],
                'constraints': [models.UniqueConstraint(fields=('school', 'device_name'), name='attendance_device_school_name_unique')],
            },
        ),
        migrations.AlterField(
            model_name='attendance',
            name='status',
            field=models.CharField(choices=[('present', 'Present'), ('late', 'Late'), ('absent', 'Absent'), ('excused', 'Excused')], default='present', max_length=20),
        ),
        migrations.AlterField(
            model_name='attendance',
            name='time_in',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendance',
            name='check_in_device',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='check_in_records', to='attendance.biometricdevice'),
        ),
        migrations.AddField(
            model_name='attendance',
            name='check_out_device',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='check_out_records', to='attendance.biometricdevice'),
        ),
        migrations.AddField(
            model_name='attendance',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=None),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='attendance',
            name='source',
            field=models.CharField(choices=[('manual', 'Manual'), ('biometric', 'Biometric'), ('import', 'Import')], default='manual', max_length=20),
        ),
        migrations.AddField(
            model_name='attendance',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=None),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name='BiometricAttendanceLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('identifier', models.CharField(max_length=120)),
                ('scanned_at', models.DateTimeField()),
                ('received_at', models.DateTimeField(auto_now_add=True)),
                ('event_type', models.CharField(choices=[('check_in', 'Check In'), ('check_out', 'Check Out'), ('late', 'Late Arrival'), ('absent', 'Absent'), ('duplicate', 'Duplicate Scan'), ('unknown', 'Unknown')], default='unknown', max_length=20)),
                ('processing_status', models.CharField(choices=[('received', 'Received'), ('processed', 'Processed'), ('duplicate', 'Duplicate'), ('rejected', 'Rejected')], default='received', max_length=20)),
                ('is_late', models.BooleanField(default=False)),
                ('message', models.TextField(blank=True)),
                ('raw_payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('attendance_record', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_logs', to='attendance.attendance')),
                ('device', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='logs', to='attendance.biometricdevice')),
                ('duplicate_of', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='duplicates', to='attendance.biometricattendancelog')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='schools.school')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_logs', to='students.student')),
            ],
            options={
                'db_table': 'attendance_biometric_log',
                'ordering': ['-scanned_at', '-id'],
                'indexes': [
                    models.Index(fields=['school', 'scanned_at'], name='attendance__school__ff04a8_idx'),
                    models.Index(fields=['school', 'identifier', 'scanned_at'], name='attendance__school__d0f6b6_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='AttendanceSMSLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('check_in', 'Check In'), ('check_out', 'Check Out'), ('late', 'Late Arrival'), ('absent', 'Absent'), ('duplicate', 'Duplicate Scan'), ('unknown', 'Unknown')], max_length=20)),
                ('recipient_phone', models.CharField(max_length=32)),
                ('message', models.TextField()),
                ('delivery_status', models.CharField(choices=[('pending', 'Pending'), ('sent', 'Sent'), ('failed', 'Failed'), ('skipped', 'Skipped')], default='pending', max_length=20)),
                ('provider_response', models.JSONField(blank=True, default=dict)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('attendance_record', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sms_logs', to='attendance.attendance')),
                ('biometric_log', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sms_logs', to='attendance.biometricattendancelog')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='schools.school')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='attendance_sms_logs', to='students.student')),
            ],
            options={
                'db_table': 'attendance_sms_log',
                'ordering': ['-created_at'],
            },
        ),
    ]