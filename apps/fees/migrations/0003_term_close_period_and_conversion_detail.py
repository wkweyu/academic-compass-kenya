# Generated manually for Phase 2.5 finance term-close scaffolding

from django.db import migrations, models
import django.db.models.deletion
import django.db.models.expressions


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0004_phase4_communications'),
        ('students', '0006_alter_student_admission_number_db_default'),
        ('fees', '0002_initial'),
        ('users', '0005_user_auth_user_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='TermClosePeriod',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.PositiveIntegerField()),
                ('term', models.PositiveSmallIntegerField()),
                ('target_year', models.PositiveIntegerField()),
                ('target_term', models.PositiveSmallIntegerField()),
                ('status', models.CharField(choices=[('CLOSING', 'Closing'), ('CLOSED', 'Closed'), ('FAILED', 'Failed')], default='CLOSING', max_length=10)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('closed_at', models.DateTimeField(blank=True, null=True)),
                ('rows_processed', models.PositiveIntegerField(default=0)),
                ('notes', models.TextField(blank=True)),
                ('closed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='term_closes_closed', to='users.user')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='term_close_periods', to='schools.school')),
                ('started_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='term_closes_started', to='users.user')),
            ],
            options={
                'db_table': 'fees_term_close_period',
                'unique_together': {('school', 'year', 'term')},
            },
        ),
        migrations.AddConstraint(
            model_name='termcloseperiod',
            constraint=models.UniqueConstraint(condition=models.Q(('status', 'CLOSED')), fields=('school', 'year', 'term'), name='fees_single_closed_period_lock'),
        ),
        migrations.CreateModel(
            name='TermCloseConversionDetail',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_year', models.PositiveIntegerField()),
                ('source_term', models.PositiveSmallIntegerField()),
                ('target_year', models.PositiveIntegerField()),
                ('target_term', models.PositiveSmallIntegerField()),
                ('source_closing_balance', models.DecimalField(decimal_places=2, max_digits=12)),
                ('target_type', models.CharField(choices=[('ARREARS', 'Arrears'), ('PREPAYMENT', 'Prepayment')], max_length=12)),
                ('target_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('period', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conversion_details', to='fees.termcloseperiod')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='term_close_conversion_details', to='schools.school')),
                ('source_vote_head', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='source_term_close_details', to='fees.votehead')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='term_close_conversion_details', to='students.student')),
            ],
            options={
                'db_table': 'fees_term_close_conversion_detail',
                'ordering': ['student_id', 'target_type', 'source_vote_head__priority', 'source_vote_head__name'],
            },
        ),
    ]
