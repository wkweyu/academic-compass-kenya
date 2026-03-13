from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.schools.models import School

from .models import Activity, ActivityBudget, ActivityExpense, ExpenseStatus, InventoryMovement, InventoryMovementType, InventoryStock, Product
from .services import record_production


class IGAModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(name='Test School')
        self.other_school = School.objects.create(name='Other School')
        self.admin_user = get_user_model().objects.create_user(
            username='iga-admin',
            email='iga-admin@example.com',
            password='testpass123',
            first_name='IGA',
            last_name='Admin',
            school=self.school,
            role='schooladmin',
        )
        self.farm_manager = get_user_model().objects.create_user(
            username='farm-manager',
            email='farm-manager@example.com',
            password='testpass123',
            first_name='Farm',
            last_name='Manager',
            school=self.school,
            role='farm_manager',
        )
        self.accountant = get_user_model().objects.create_user(
            username='iga-accountant',
            email='iga-accountant@example.com',
            password='testpass123',
            first_name='IGA',
            last_name='Accountant',
            school=self.school,
            role='accountant',
        )
        self.sales_officer = get_user_model().objects.create_user(
            username='iga-sales',
            email='iga-sales@example.com',
            password='testpass123',
            first_name='IGA',
            last_name='Sales',
            school=self.school,
            role='sales_officer',
        )
        self.teacher = get_user_model().objects.create_user(
            username='iga-teacher',
            email='iga-teacher@example.com',
            password='testpass123',
            first_name='IGA',
            last_name='Teacher',
            school=self.school,
            role='teacher',
        )
        self.other_school_user = get_user_model().objects.create_user(
            username='other-admin',
            email='other-admin@example.com',
            password='testpass123',
            first_name='Other',
            last_name='Admin',
            school=self.other_school,
            role='schooladmin',
        )
        self.client.force_authenticate(user=self.admin_user)
        self.activity = Activity.objects.create(
            school=self.school,
            name='Dairy Farming',
            manager=self.farm_manager,
        )
        self.product = Product.objects.create(
            school=self.school,
            name='Milk',
            unit_of_measure='Litres',
            sale_price=Decimal('60.00'),
        )
        self.other_school_product = Product.objects.create(
            school=self.other_school,
            name='Eggs',
            unit_of_measure='Trays',
            sale_price=Decimal('450.00'),
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_record_production_updates_stock_and_movement(self):
        record = record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('120.00'),
            recorded_by=self.farm_manager,
        )

        stock = InventoryStock.objects.get(product=self.product, school=self.school)
        movement = InventoryMovement.objects.get(product=self.product, movement_type=InventoryMovementType.PRODUCTION)

        self.assertEqual(record.quantity, Decimal('120.00'))
        self.assertEqual(stock.quantity_available, Decimal('120.00'))
        self.assertEqual(movement.reference, f'IGA-PROD-{record.id}')

    def test_production_api_requires_farm_manager_or_admin_role(self):
        self.authenticate(self.teacher)

        response = self.client.post(
            reverse('iga-production-list'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '15.00',
                'unit': 'Litres',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_sale_api_reduces_inventory_and_posts_accounting(self):
        self.authenticate(self.sales_officer)
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('50.00'),
            recorded_by=self.farm_manager,
        )

        response = self.client.post(
            reverse('iga-sale-list'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '10.00',
                'unit_price': '75.00',
                'customer_name': 'Local Market',
                'payment_method': 'cash',
                'reference': 'INV-001',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InventoryStock.objects.get(product=self.product, school=self.school).quantity_available, Decimal('40.00'))
        self.assertEqual(response.data['total_amount'], '750.00')
        self.assertEqual(response.data['accounting_entry']['entry_type'], 'iga_sale')

    def test_sale_api_rejects_insufficient_stock(self):
        self.authenticate(self.sales_officer)
        response = self.client.post(
            reverse('iga-sale-list'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '5.00',
                'unit_price': '75.00',
                'payment_method': 'cash',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data)

    def test_cross_school_sale_request_is_rejected(self):
        self.authenticate(self.sales_officer)
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('25.00'),
            recorded_by=self.farm_manager,
        )

        response = self.client.post(
            reverse('iga-sale-list'),
            {
                'activity': self.activity.id,
                'product': self.other_school_product.id,
                'quantity': '5.00',
                'unit_price': '75.00',
                'payment_method': 'cash',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('product', response.data)

    def test_spoilage_api_reduces_inventory_and_persists_accounting(self):
        self.authenticate(self.farm_manager)
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('30.00'),
            recorded_by=self.farm_manager,
        )

        response = self.client.post(
            reverse('iga-record-spoilage'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '4.00',
                'reference': 'SPOIL-001',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InventoryStock.objects.get(product=self.product, school=self.school).quantity_available, Decimal('26.00'))
        movement = InventoryMovement.objects.get(id=response.data['movement_id'])
        self.assertEqual(movement.movement_type, InventoryMovementType.SPOILAGE)
        self.assertEqual(movement.accounting_entry['entry_type'], 'iga_inventory_loss')
        self.assertIsNotNone(movement.accounting_posted_at)

    def test_internal_use_api_reduces_inventory_and_persists_accounting(self):
        self.authenticate(self.admin_user)
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('18.00'),
            recorded_by=self.farm_manager,
        )

        response = self.client.post(
            reverse('iga-record-internal-use'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '3.00',
                'reference': 'KITCHEN-001',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InventoryStock.objects.get(product=self.product, school=self.school).quantity_available, Decimal('15.00'))
        movement = InventoryMovement.objects.get(id=response.data['movement_id'])
        self.assertEqual(movement.movement_type, InventoryMovementType.INTERNAL_USE)
        self.assertEqual(movement.accounting_entry['entry_type'], 'iga_internal_consumption')

    def test_expense_approval_action_updates_status_and_accounting(self):
        self.authenticate(self.accountant)
        expense_response = self.client.post(
            reverse('iga-expense-list'),
            {
                'activity': self.activity.id,
                'expense_category': 'feed',
                'description': 'Animal feed purchase',
                'amount': '5000.00',
                'procurement_reference': 'PO-001',
            },
            format='json',
        )
        self.assertEqual(expense_response.status_code, 201)
        expense = ActivityExpense.objects.get(id=expense_response.data['id'])

        self.authenticate(self.admin_user)
        response = self.client.post(reverse('iga-expense-approve', args=[expense.id]), {}, format='json')

        self.assertEqual(response.status_code, 200)
        expense.refresh_from_db()
        self.assertEqual(expense.status, ExpenseStatus.APPROVED)
        self.assertEqual(expense.approved_by, self.admin_user)
        self.assertEqual(expense.accounting_entry['entry_type'], 'iga_expense')

    def test_expense_approval_requires_admin_role(self):
        expense = ActivityExpense.objects.create(
            school=self.school,
            activity=self.activity,
            expense_category='feed',
            description='Animal feed purchase',
            amount=Decimal('5000.00'),
            recorded_by=self.accountant,
        )

        self.authenticate(self.accountant)
        response = self.client.post(reverse('iga-expense-approve', args=[expense.id]), {}, format='json')

        self.assertEqual(response.status_code, 403)

    def test_budget_vs_actual_report_returns_variance(self):
        ActivityBudget.objects.create(
            school=self.school,
            activity=self.activity,
            category='feed',
            budget_amount=Decimal('1200.00'),
            period_start='2026-01-01',
            period_end='2026-03-31',
        )
        expense = ActivityExpense.objects.create(
            school=self.school,
            activity=self.activity,
            expense_category='feed',
            description='Animal feed purchase',
            amount=Decimal('5000.00'),
            recorded_by=self.accountant,
            status=ExpenseStatus.APPROVED,
            approved_by=self.admin_user,
        )

        response = self.client.get(
            reverse('iga-budget-vs-actual-report'),
            {'start_date': '2026-01-01', 'end_date': '2026-03-31'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['budget_amount'], Decimal('1200.00'))
        self.assertEqual(response.data[0]['actual_amount'], Decimal('5000.00'))
        self.assertEqual(response.data[0]['variance'], Decimal('-3800.00'))

    def test_profitability_report_returns_net_profit(self):
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('20.00'),
            recorded_by=self.farm_manager,
        )
        self.authenticate(self.sales_officer)
        self.client.post(
            reverse('iga-sale-list'),
            {
                'activity': self.activity.id,
                'product': self.product.id,
                'quantity': '10.00',
                'unit_price': '100.00',
                'payment_method': 'cash',
            },
            format='json',
        )
        expense = ActivityExpense.objects.create(
            school=self.school,
            activity=self.activity,
            expense_category='feed',
            description='Feed',
            amount=Decimal('250.00'),
            status=ExpenseStatus.APPROVED,
            recorded_by=self.accountant,
            approved_by=self.admin_user,
        )
        self.assertIsNotNone(expense.id)

        self.authenticate(self.admin_user)
        response = self.client.get(reverse('iga-profitability-report'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['activity_name'], 'Dairy Farming')
        self.assertEqual(response.data[0]['total_sales'], Decimal('1000.00'))
        self.assertEqual(response.data[0]['total_expenses'], Decimal('250.00'))
        self.assertEqual(response.data[0]['net_profit_loss'], Decimal('750.00'))

    def test_overview_report_returns_summary_sections(self):
        record_production(
            school=self.school,
            activity=self.activity,
            product=self.product,
            quantity=Decimal('12.00'),
            recorded_by=self.farm_manager,
        )
        ActivityExpense.objects.create(
            school=self.school,
            activity=self.activity,
            expense_category='feed',
            description='Pending feed expense',
            amount=Decimal('150.00'),
            status=ExpenseStatus.PENDING,
            recorded_by=self.accountant,
        )

        response = self.client.get(reverse('iga-reports-overview'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', response.data)
        self.assertIn('profitability', response.data)
        self.assertIn('inventory', response.data)
        self.assertIn('recent_movements', response.data)
        self.assertEqual(response.data['summary']['activity_count'], 1)
        self.assertEqual(response.data['summary']['pending_expense_count'], 1)
