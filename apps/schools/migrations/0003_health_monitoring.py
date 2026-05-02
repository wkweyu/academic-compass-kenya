from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0002_saas_phase1'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolHealthSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('calculated_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('health_score', models.PositiveSmallIntegerField(default=0)),
                ('engagement_score', models.PositiveSmallIntegerField(default=0)),
                ('data_completeness_score', models.PositiveSmallIntegerField(default=0)),
                ('payment_health_score', models.PositiveSmallIntegerField(default=0)),
                ('account_health_score', models.PositiveSmallIntegerField(default=0)),
                ('trend', models.CharField(choices=[('IMPROVING', 'Improving'), ('DECLINING', 'Declining'), ('STABLE', 'Stable')], default='STABLE', max_length=20)),
                ('alerts', models.JSONField(blank=True, default=list)),
                ('metrics', models.JSONField(blank=True, default=dict)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='health_snapshots', to='schools.school')),
            ],
            options={'ordering': ['-calculated_at']},
        ),
        migrations.CreateModel(
            name='UpsellOpportunity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('trigger_type', models.CharField(db_index=True, max_length=100)),
                ('recommended_action', models.TextField()),
                ('estimated_value', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('priority', models.PositiveSmallIntegerField(default=3)),
                ('status', models.CharField(choices=[('OPEN', 'Open'), ('CONTACT_MADE', 'Contact Made'), ('PROPOSAL_SENT', 'Proposal Sent'), ('NEGOTIATION', 'Negotiation'), ('WON', 'Won'), ('LOST', 'Lost')], default='OPEN', max_length=20)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('closed_reason', models.TextField(blank=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='upsell_opportunities', to='schools.school')),
            ],
            options={'ordering': ['priority', '-created_at']},
        ),
    ]
