from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0004_phase4_communications'),
        ('fees', '0003_term_close_period_and_conversion_detail'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduledExportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('report', models.CharField(choices=[('outstanding', 'Outstanding Balances'), ('student_aging', 'Student Aging'), ('collection_effectiveness', 'Collection Effectiveness'), ('activity_log', 'Finance Activity Log')], max_length=40)),
                ('filters', models.JSONField(blank=True, default=dict)),
                ('run_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('SCHEDULED', 'Scheduled'), ('READY', 'Ready'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')], default='SCHEDULED', max_length=20)),
                ('executed_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='scheduled_exports_created', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='scheduled_export_jobs', to='schools.school')),
            ],
            options={
                'db_table': 'fees_scheduled_export_job',
                'ordering': ['-run_at', '-id'],
            },
        ),
    ]
