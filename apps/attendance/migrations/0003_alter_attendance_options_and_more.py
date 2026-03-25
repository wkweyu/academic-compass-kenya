from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_biometric_attendance_system'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='attendance',
            options={'ordering': ['-date', 'student__full_name']},
        ),
        migrations.RenameIndex(
            model_name='biometricattendancelog',
            new_name='attendance__school__691408_idx',
            old_name='attendance__school__ff04a8_idx',
        ),
        migrations.RenameIndex(
            model_name='biometricattendancelog',
            new_name='attendance__school__0de583_idx',
            old_name='attendance__school__d0f6b6_idx',
        ),
    ]