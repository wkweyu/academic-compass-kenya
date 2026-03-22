from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='converted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='school',
            name='details',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='school',
            name='status',
            field=models.CharField(
                choices=[('LEAD', 'Lead'), ('ONBOARDING', 'Onboarding'), ('ACTIVE', 'Active'), ('CHURNED', 'Churned')],
                db_index=True,
                default='ACTIVE',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='school',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='school',
            name='assigned_staff',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_schools', to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='Lead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stage', models.CharField(choices=[('NEW', 'New'), ('CONTACTED', 'Contacted'), ('DEMO_SCHEDULED', 'Demo Scheduled'), ('DEMO_COMPLETED', 'Demo Completed'), ('NEGOTIATION', 'Negotiation'), ('CONTRACT_SENT', 'Contract Sent'), ('WON', 'Won'), ('LOST', 'Lost')], db_index=True, default='NEW', max_length=30)),
                ('source', models.CharField(blank=True, max_length=100)),
                ('priority', models.CharField(choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')], default='MEDIUM', max_length=10)),
                ('notes', models.TextField(blank=True)),
                ('loss_reason', models.TextField(blank=True)),
                ('last_assigned_at', models.DateTimeField(blank=True, null=True)),
                ('lost_at', models.DateTimeField(blank=True, null=True)),
                ('converted_at', models.DateTimeField(blank=True, null=True)),
                ('conversion_metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_leads', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_leads', to=settings.AUTH_USER_MODEL)),
                ('school', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='lead_profile', to='schools.school')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_leads', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='OnboardingProgress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_step', models.CharField(choices=[('BASIC_INFO', 'Basic Info'), ('PLAN_SELECTION', 'Plan Selection'), ('ADMIN_SETUP', 'Admin Setup'), ('DATA_IMPORT', 'Data Import'), ('CONFIGURATION', 'Configuration'), ('TRAINING', 'Training'), ('HANDBOOK', 'Handbook')], default='BASIC_INFO', max_length=30)),
                ('completed_steps', models.JSONField(blank=True, default=dict)),
                ('step_payloads', models.JSONField(blank=True, default=dict)),
                ('blockers', models.JSONField(blank=True, default=list)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('handed_over_to_school_at', models.DateTimeField(blank=True, null=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='onboarding_assignments', to=settings.AUTH_USER_MODEL)),
                ('handed_over_by_staff', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='completed_onboarding_handoffs', to=settings.AUTH_USER_MODEL)),
                ('school', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='onboarding_progress', to='schools.school')),
            ],
            options={'ordering': ['-started_at']},
        ),
        migrations.CreateModel(
            name='SchoolTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('step', models.CharField(blank=True, choices=[('', 'No step'), ('BASIC_INFO', 'Basic Info'), ('PLAN_SELECTION', 'Plan Selection'), ('ADMIN_SETUP', 'Admin Setup'), ('DATA_IMPORT', 'Data Import'), ('CONFIGURATION', 'Configuration'), ('TRAINING', 'Training'), ('HANDBOOK', 'Handbook')], default='', max_length=30)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('IN_PROGRESS', 'In Progress'), ('COMPLETE', 'Complete'), ('BLOCKED', 'Blocked')], db_index=True, default='PENDING', max_length=20)),
                ('is_required', models.BooleanField(default=True)),
                ('due_at', models.DateTimeField(blank=True, null=True)),
                ('blocked_reason', models.TextField(blank=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='school_tasks', to=settings.AUTH_USER_MODEL)),
                ('completed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='completed_school_tasks', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_school_tasks', to=settings.AUTH_USER_MODEL)),
                ('lead', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='schools.lead')),
                ('onboarding_progress', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='schools.onboardingprogress')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='schools.school')),
            ],
            options={'ordering': ['due_at', '-created_at']},
        ),
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(db_index=True, max_length=100)),
                ('description', models.TextField()),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to=settings.AUTH_USER_MODEL)),
                ('lead', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to='schools.lead')),
                ('onboarding_progress', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to='schools.onboardingprogress')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activity_logs', to='schools.school')),
                ('task', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to='schools.schooltask')),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
