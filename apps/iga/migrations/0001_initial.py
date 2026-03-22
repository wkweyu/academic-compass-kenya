# Generated manually for the IGA module.

import django.conf
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(django.conf.settings.AUTH_USER_MODEL),
        ('schools', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Activity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('start_date', models.DateField(default=django.utils.timezone.localdate)),
                ('status', models.CharField(choices=[('active', 'Active'), ('planned', 'Planned'), ('on_hold', 'On Hold'), ('closed', 'Closed')], default='active', max_length=20)),
                ('income_account_id', models.PositiveIntegerField(blank=True, null=True)),
                ('expense_account_id', models.PositiveIntegerField(blank=True, null=True)),
                ('inventory_account_id', models.PositiveIntegerField(blank=True, null=True)),
                ('manager', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='managed_iga_activities', to=django.conf.settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activitys', to='schools.school')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('school', 'name')},
            },
        ),
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('unit_of_measure', models.CharField(max_length=30)),
                ('sale_price', models.DecimalField(decimal_places=2, default='0.00', max_digits=12)),
                ('inventory_account_id', models.PositiveIntegerField(blank=True, null=True)),
                ('income_account_id', models.PositiveIntegerField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='products', to='schools.school')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('school', 'name')},
            },
        ),
        migrations.CreateModel(
            name='InventoryStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quantity_available', models.DecimalField(decimal_places=2, default='0.00', max_digits=12)),
                ('unit', models.CharField(max_length=30)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_stocks', to='iga.product')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventorystocks', to='schools.school')),
            ],
            options={
                'ordering': ['product__name'],
                'unique_together': {('school', 'product')},
            },
        ),
        migrations.CreateModel(
            name='InventoryMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('movement_type', models.CharField(choices=[('production', 'Production'), ('sale', 'Sale'), ('internal_use', 'Internal Use'), ('spoilage', 'Spoilage'), ('adjustment', 'Adjustment')], max_length=20)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit', models.CharField(max_length=30)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('date', models.DateTimeField(default=django.utils.timezone.now)),
                ('notes', models.TextField(blank=True)),
                ('accounting_entry', models.JSONField(blank=True, default=dict)),
                ('accounting_posted_at', models.DateTimeField(blank=True, null=True)),
                ('activity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_movements', to='iga.activity')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_movements', to='iga.product')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='iga_inventory_movements', to=django.conf.settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventorymovements', to='schools.school')),
            ],
            options={
                'ordering': ['-date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ProductionRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit', models.CharField(max_length=30)),
                ('production_date', models.DateField(default=django.utils.timezone.localdate)),
                ('notes', models.TextField(blank=True)),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_records', to='iga.activity')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_records', to='iga.product')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='iga_production_records', to=django.conf.settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='productionrecords', to='schools.school')),
            ],
            options={
                'ordering': ['-production_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ProduceSale',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('customer_name', models.CharField(blank=True, max_length=255)),
                ('sale_date', models.DateField(default=django.utils.timezone.localdate)),
                ('payment_method', models.CharField(choices=[('cash', 'Cash'), ('mpesa', 'M-PESA'), ('bank', 'Bank'), ('credit', 'Credit'), ('other', 'Other')], default='cash', max_length=20)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('accounting_entry', models.JSONField(blank=True, default=dict)),
                ('accounting_posted_at', models.DateTimeField(blank=True, null=True)),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='produce_sales', to='iga.activity')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='produce_sales', to='iga.product')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='iga_produce_sales', to=django.conf.settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='producesales', to='schools.school')),
            ],
            options={
                'ordering': ['-sale_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ActivityExpense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('expense_category', models.CharField(choices=[('feed', 'Feed'), ('fertilizer', 'Fertilizer'), ('seeds', 'Seeds'), ('medicine', 'Medicine'), ('fuel', 'Fuel'), ('labour', 'Labour'), ('maintenance', 'Maintenance'), ('other', 'Other')], default='other', max_length=30)),
                ('description', models.TextField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('expense_date', models.DateField(default=django.utils.timezone.localdate)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('procurement_reference', models.CharField(blank=True, max_length=100)),
                ('rejection_reason', models.TextField(blank=True)),
                ('accounting_entry', models.JSONField(blank=True, default=dict)),
                ('accounting_posted_at', models.DateTimeField(blank=True, null=True)),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='expenses', to='iga.activity')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='iga_approved_expenses', to=django.conf.settings.AUTH_USER_MODEL)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='iga_recorded_expenses', to=django.conf.settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activityexpenses', to='schools.school')),
            ],
            options={
                'ordering': ['-expense_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ActivityBudget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.CharField(max_length=50)),
                ('budget_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('period_start', models.DateField()),
                ('period_end', models.DateField()),
                ('notes', models.TextField(blank=True)),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='budgets', to='iga.activity')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activitybudgets', to='schools.school')),
            ],
            options={
                'ordering': ['-period_start', 'activity__name', 'category'],
                'unique_together': {('school', 'activity', 'category', 'period_start', 'period_end')},
            },
        ),
    ]
