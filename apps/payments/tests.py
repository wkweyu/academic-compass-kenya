from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.fees.models import PaymentTransaction, FinanceActivityLog, VoteHead, FeeBalance
from apps.payments.models import PaymentEvent, PaymentIngressLog, SchoolPaymentConfig
from apps.schools.models import School
from apps.students.models import Student
from apps.users.models import User


class PaymentReportsAPITests(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='Alpha School', email='alpha@example.com')
        self.other_school = School.objects.create(name='Beta School', email='beta@example.com')

        self.user = User.objects.create_user(
            email='finance.alpha@example.com',
            username='finance-alpha',
            first_name='Finance',
            last_name='Alpha',
            password='Password123!',
            role='finance',
            school=self.school,
        )
        self.client.force_authenticate(self.user)

        self.student = Student.objects.create(
            school=self.school,
            admission_number='ADM-PAY-001',
            level='LP',
            full_name='Jane Payer',
            gender='F',
            date_of_birth=date(2014, 5, 10),
            guardian_name='Parent One',
            guardian_phone='0712345678',
            admission_year=2026,
        )
        self.other_student = Student.objects.create(
            school=self.other_school,
            admission_number='ADM-PAY-002',
            level='LP',
            full_name='John Other',
            gender='M',
            date_of_birth=date(2014, 8, 20),
            guardian_name='Parent Two',
            guardian_phone='0712345679',
            admission_year=2026,
        )

        self.payment_config = SchoolPaymentConfig.objects.create(
            school=self.school,
            provider='mpesa',
            short_code='123456',
            account_name='Alpha Fees',
        )
        self.other_payment_config = SchoolPaymentConfig.objects.create(
            school=self.other_school,
            provider='kcb_buni',
            short_code='KCB-01',
            account_name='Beta Fees',
        )

    def _seed_transactions(self):
        PaymentTransaction.objects.create(
            school=self.school,
            student=self.student,
            amount=Decimal('1500.00'),
            mode='mpesa',
            date=timezone.make_aware(datetime(2026, 5, 1, 9, 0, 0)),
            remarks='First payment',
            apportion_log={'Tuition': 1000, 'Transport': 500},
        )
        PaymentTransaction.objects.create(
            school=self.school,
            student=self.student,
            amount=Decimal('2500.00'),
            mode='bank',
            date=timezone.make_aware(datetime(2026, 5, 2, 10, 30, 0)),
            remarks='Second payment',
            apportion_log={'Tuition': 2500},
        )
        PaymentTransaction.objects.create(
            school=self.other_school,
            student=self.other_student,
            amount=Decimal('9999.00'),
            mode='cash',
            date=timezone.make_aware(datetime(2026, 5, 2, 11, 0, 0)),
            remarks='Other school payment',
            apportion_log={'Tuition': 9999},
        )

    def _seed_events(self):
        ingress_1 = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='123456',
            raw_payload={'txn': 'A1'},
            resolved_school=self.school,
        )
        PaymentEvent.objects.create(
            school=self.school,
            ingress_log=ingress_1,
            idempotency_key='mpesa:A1',
            provider='mpesa',
            transaction_code='A1',
            amount=Decimal('1500.00'),
            reference=self.student.admission_number,
            payment_config=self.payment_config,
            student=self.student,
            status='RECONCILED',
        )

        ingress_2 = PaymentIngressLog.objects.create(
            provider='kcb_buni',
            short_code='KCB-01',
            raw_payload={'txn': 'B1'},
            resolved_school=self.other_school,
        )
        PaymentEvent.objects.create(
            school=self.other_school,
            ingress_log=ingress_2,
            idempotency_key='kcb_buni:B1',
            provider='kcb_buni',
            transaction_code='B1',
            amount=Decimal('5000.00'),
            reference=self.other_student.admission_number,
            payment_config=self.other_payment_config,
            student=self.other_student,
            status='RECONCILED',
        )

    def test_daily_collections_report_is_school_scoped(self):
        self._seed_transactions()

        response = self.client.get('/api/payments/reports/daily/', {'start_date': '2026-05-01', 'end_date': '2026-05-31'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        total_amount = sum(Decimal(str(row['amount'])) for row in response.data['results'])
        self.assertEqual(total_amount, Decimal('4000.0'))

    def test_provider_report_is_school_scoped(self):
        self._seed_events()

        response = self.client.get('/api/payments/reports/providers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['provider'], 'mpesa')
        self.assertEqual(Decimal(str(response.data['results'][0]['amount'])), Decimal('1500.0'))

    def test_votehead_report_aggregates_from_apportion_log(self):
        self._seed_transactions()

        response = self.client.get('/api/payments/reports/voteheads/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        voteheads = {row['vote_head']: Decimal(str(row['amount'])) for row in response.data['results']}
        self.assertEqual(voteheads['Tuition'], Decimal('3500.0'))
        self.assertEqual(voteheads['Transport'], Decimal('500.0'))

    def test_report_endpoints_require_finance_role(self):
        unauthorized_user = User.objects.create_user(
            email='staff.alpha@example.com',
            username='staff-alpha',
            first_name='Staff',
            last_name='Alpha',
            password='Password123!',
            role='staff',
            school=self.school,
        )
        self.client.force_authenticate(unauthorized_user)

        response = self.client.get('/api/payments/reports/daily/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.payments.views.ReconciliationService.reprocess')
    def test_reprocess_endpoint_creates_activity_log(self, mock_reprocess):
        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='123456',
            raw_payload={'txn': 'R1'},
            resolved_school=self.school,
        )
        event = PaymentEvent.objects.create(
            school=self.school,
            ingress_log=ingress,
            idempotency_key='mpesa:R1',
            provider='mpesa',
            transaction_code='R1',
            amount=Decimal('1200.00'),
            reference=self.student.admission_number,
            payment_config=self.payment_config,
            status='UNRESOLVED_STUDENT',
        )
        event.retry_count = 1
        event.status = 'RECONCILED'
        mock_reprocess.return_value = event

        response = self.client.post(f'/api/payments/events/{event.id}/reprocess/', format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            FinanceActivityLog.objects.filter(
                school=self.school,
                action='REPROCESS',
            ).exists()
        )

    def test_payment_detail_includes_timeline_fields(self):
        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='123456',
            raw_payload={'txn': 'TL1'},
            resolved_school=self.school,
        )
        event = PaymentEvent.objects.create(
            school=self.school,
            ingress_log=ingress,
            idempotency_key='mpesa:TL1',
            provider='mpesa',
            transaction_code='TL1',
            amount=Decimal('800.00'),
            reference=self.student.admission_number,
            payment_config=self.payment_config,
            student=self.student,
            status='RECONCILED',
        )

        response = self.client.get(f'/api/payments/events/{event.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ingress_received_at', response.data)
        self.assertIn('routed_at', response.data)
        self.assertEqual(response.data['sms_status'], 'PENDING')

    def test_payment_detail_is_school_scoped(self):
        ingress_other = PaymentIngressLog.objects.create(
            provider='kcb_buni',
            short_code='KCB-01',
            raw_payload={'txn': 'TL2'},
            resolved_school=self.other_school,
        )
        other_event = PaymentEvent.objects.create(
            school=self.other_school,
            ingress_log=ingress_other,
            idempotency_key='kcb_buni:TL2',
            provider='kcb_buni',
            transaction_code='TL2',
            amount=Decimal('1000.00'),
            reference=self.other_student.admission_number,
            payment_config=self.other_payment_config,
            student=self.other_student,
            status='RECONCILED',
        )

        response = self.client.get(f'/api/payments/events/{other_event.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_payment_reports_export_returns_csv(self):
        self._seed_transactions()

        response = self.client.get(
            '/api/payments/reports/export/',
            {'report': 'daily', 'start_date': '2026-05-01', 'end_date': '2026-05-31'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('Date,Transactions,Amount', response.content.decode('utf-8'))

    def test_payment_reports_export_supports_streaming_csv(self):
        self._seed_transactions()

        response = self.client.get(
            '/api/payments/reports/export/',
            {'report': 'daily', 'start_date': '2026-05-01', 'end_date': '2026-05-31', 'stream': 'true'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        stream_bytes = b''.join(response.streaming_content)
        self.assertIn('Date,Transactions,Amount', stream_bytes.decode('utf-8'))


class FinanceIntegrityandSandboxTests(APITestCase):
    def setUp(self):
        # Create isolated schools
        self.school_alpha = School.objects.create(name='Alpha School', code='ALPHA', email='alpha@example.com')
        self.school_beta = School.objects.create(name='Beta School', code='BETA', email='beta@example.com')

        # Create localized users
        self.user_alpha = User.objects.create_user(
            email='finance.alpha@example.com',
            username='fin-alpha',
            first_name='Finance',
            last_name='Alpha',
            password='Password123!',
            role='finance',
            school=self.school_alpha,
        )
        self.user_beta = User.objects.create_user(
            email='finance.beta@example.com',
            username='fin-beta',
            first_name='Finance',
            last_name='Beta',
            password='Password123!',
            role='finance',
            school=self.school_beta,
        )

        # Create students in respective schools
        self.student_alpha = Student.objects.create(
            school=self.school_alpha,
            admission_number='ADM-ALPHA-001',
            level='LP',
            full_name='Jane Alpha',
            gender='F',
            date_of_birth=date(2014, 5, 10),
            guardian_name='Parent Alpha',
            guardian_phone='0712345678',
            admission_year=2026,
        )
        self.student_beta = Student.objects.create(
            school=self.school_beta,
            admission_number='ADM-BETA-001',
            level='LP',
            full_name='John Beta',
            gender='M',
            date_of_birth=date(2014, 8, 20),
            guardian_name='Parent Beta',
            guardian_phone='0712345679',
            admission_year=2026,
        )

        # Voteheads
        self.tuition_alpha = VoteHead.objects.create(school=self.school_alpha, name='Tuition', priority=1)
        self.transport_alpha = VoteHead.objects.create(school=self.school_alpha, name='Transport', priority=2)
        
        self.tuition_beta = VoteHead.objects.create(school=self.school_beta, name='Tuition', priority=1)

        # Payment Configs
        self.config_alpha = SchoolPaymentConfig.objects.create(
            school=self.school_alpha,
            provider='mpesa',
            short_code='654321',
            account_name='Alpha Pay',
            is_active=True
        )
        self.config_beta = SchoolPaymentConfig.objects.create(
            school=self.school_beta,
            provider='kcb_buni',
            short_code='987654',
            account_name='Beta Pay',
            is_active=True
        )

    def test_cross_tenant_query_isolation(self):
        """
        Verify that an authenticated user from School Alpha cannot retrieve
        any events, logs, or reports from School Beta.
        """
        # Create a private event for School Beta
        ingress_beta = PaymentIngressLog.objects.create(
            provider='kcb_buni',
            short_code='987654',
            raw_payload={'txn': 'B1'},
            resolved_school=self.school_beta,
        )
        event_beta = PaymentEvent.objects.create(
            school=self.school_beta,
            ingress_log=ingress_beta,
            idempotency_key='kcb_buni:B1',
            provider='kcb_buni',
            transaction_code='B1',
            amount=Decimal('3000.00'),
            reference='ADM-BETA-001',
            payment_config=self.config_beta,
            student=self.student_beta,
            status='RECONCILED',
        )

        # Authenticate User Alpha
        self.client.force_authenticate(self.user_alpha)

        # 1. Fetching Beta's event details directly must return 404
        response = self.client.get(f'/api/payments/events/{event_beta.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Querying all events lists must NOT leak Beta's event
        response = self.client.get('/api/payments/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        if isinstance(response.data, list):
            results = response.data
        else:
            results = response.data.get('results', [])
            
        ids = [str(row['id']) for row in results]
        self.assertNotIn(str(event_beta.id), ids)

    def test_global_and_per_student_ledger_invariants(self):
        """
        Verify the Global & Per-student ledger invariants.
        For any payment, sum(apportionments) == transaction.amount.
        FeeBalance.closing_balance + amount_paid == opening_balance + amount_invoiced.
        """
        # Set up a target fee balance for Tuition and Transport
        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=self.tuition_alpha,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('10000.00'),
            amount_paid=Decimal('0.00'),
            closing_balance=Decimal('10000.00'),
        )
        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=self.transport_alpha,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('5000.00'),
            amount_paid=Decimal('0.00'),
            closing_balance=Decimal('5000.00'),
        )

        from apps.payments.providers.base import PaymentEventData
        from apps.payments.services.reconciliation import ReconciliationService

        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='654321',
            raw_payload={'TransID': 'TX123'},
            resolved_school=self.school_alpha
        )
        data = PaymentEventData(
            provider='mpesa',
            transaction_code='TX123',
            amount=Decimal('12000.00'),
            phone_number='0712345678',
            reference='ADM-ALPHA-001',
            short_code='654321',
            raw_payload={'TransID': 'TX123'}
        )

        # Run reconciliation
        event = ReconciliationService.reconcile(data, self.config_alpha, ingress)
        self.assertEqual(event.status, 'RECONCILED')

        # Prove Global Ledger Invariant: sum(apportion_log['allocations']) == amount
        tx = event.payment_transaction
        allocations = tx.apportion_log['allocations']
        sum_allocated = sum(Decimal(str(item['amount'])) for item in allocations)
        self.assertEqual(sum_allocated, tx.amount)

        # Prove Per-Student Ledger Invariant:
        # For each FeeBalance record, opening_balance + amount_invoiced - amount_paid == closing_balance
        balances = FeeBalance.objects.filter(school=self.school_alpha, student=self.student_alpha)
        self.assertEqual(balances.count(), 2)
        for fb in balances:
            self.assertEqual(
                fb.opening_balance + fb.amount_invoiced - fb.amount_paid,
                fb.closing_balance
            )

    def test_apportionment_skips_negative_balance_voteheads(self):
        from apps.fees.services import apportion_payment

        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=self.tuition_alpha,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('5000.00'),
            amount_paid=Decimal('0.00'),
            closing_balance=Decimal('5000.00'),
        )
        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=self.transport_alpha,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('5000.00'),
            amount_paid=Decimal('8000.00'),
            closing_balance=Decimal('-3000.00'),
        )

        allocations = apportion_payment(
            self.school_alpha,
            self.student_alpha,
            Decimal('12000.00'),
            year=2026,
            term=1,
        )

        self.assertEqual(allocations, [{'vote_head': 'Tuition', 'amount': Decimal('12000.00')}])

    def test_idempotency_replay_guards(self):
        """
        Verify that replay attempts on the same transaction key
        raise an error or are rejected so double posting is impossible.
        """
        from apps.payments.providers.base import PaymentEventData
        from apps.payments.services.reconciliation import ReconciliationService

        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='654321',
            raw_payload={'TransID': 'TX999'},
            resolved_school=self.school_alpha
        )
        data = PaymentEventData(
            provider='mpesa',
            transaction_code='TX999',
            amount=Decimal('500.00'),
            phone_number='0712345678',
            reference='ADM-ALPHA-001',
            short_code='654321',
            raw_payload={'TransID': 'TX999'}
        )

        # First run succeeds
        event1 = ReconciliationService.reconcile(data, self.config_alpha, ingress)
        self.assertEqual(event1.status, 'RECONCILED')

        # Second run should trigger DB unique constraint (idempotency_key) if run directly,
        # or be blocked in business logic.
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            # Attempt to create duplicate event with same idempotency key
            PaymentEvent.objects.create(
                school=self.school_alpha,
                ingress_log=ingress,
                idempotency_key=f'mpesa:TX999',
                provider='mpesa',
                transaction_code='TX999',
                amount=Decimal('500.00'),
                reference='ADM-ALPHA-001',
                payment_config=self.config_alpha,
                status='RECEIVED'
            )

    def test_unresolved_student_routing(self):
        """
        Validate that an unknown admission reference resolves to UNRESOLVED_STUDENT,
        keeps the ingress log, but does NOT create any Fee PaymentTransaction or FeeBalances.
        """
        from apps.payments.providers.base import PaymentEventData
        from apps.payments.services.reconciliation import ReconciliationService

        initial_tx_count = PaymentTransaction.objects.count()

        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='654321',
            raw_payload={'TransID': 'TX_UNKNOWN'},
            resolved_school=self.school_alpha
        )
        data = PaymentEventData(
            provider='mpesa',
            transaction_code='TX_UNKNOWN',
            amount=Decimal('1000.00'),
            phone_number='0711111111',
            reference='ADM-UNKNOWN',
            short_code='654321',
            raw_payload={'TransID': 'TX_UNKNOWN'}
        )

        event = ReconciliationService.reconcile(data, self.config_alpha, ingress)
        self.assertEqual(event.status, 'UNRESOLVED_STUDENT')
        self.assertEqual(PaymentTransaction.objects.count(), initial_tx_count)

    def test_partial_failure_transaction_rollback(self):
        """
        Verify that if a reconciliation fails halfway through (e.g. balance update raises exception),
        all records (including PaymentTransaction) are rolled back atomically, leaving no orphan structures.
        """
        from apps.payments.providers.base import PaymentEventData
        from apps.payments.services.reconciliation import ReconciliationService

        ingress = PaymentIngressLog.objects.create(
            provider='mpesa',
            short_code='654321',
            raw_payload={'TransID': 'TX_FAIL'},
            resolved_school=self.school_alpha
        )
        data = PaymentEventData(
            provider='mpesa',
            transaction_code='TX_FAIL',
            amount=Decimal('1000.00'),
            phone_number='0711111111',
            reference='ADM-ALPHA-001',
            short_code='654321',
            raw_payload={'TransID': 'TX_FAIL'}
        )

        initial_tx_count = PaymentTransaction.objects.count()

        # Mock apply_payment_to_balances to raise an unexpected runtime error
        with patch('apps.payments.services.reconciliation.apply_payment_to_balances', side_effect=ValueError("Simulated ledger write error")):
            with self.assertRaises(ValueError):
                ReconciliationService.reconcile(data, self.config_alpha, ingress)

        # Confirm that no PaymentTransaction was created (properly rolled back!)
        self.assertEqual(PaymentTransaction.objects.count(), initial_tx_count)

    def test_term_close_conservation(self):
        """
        Verify mathematical conservation during term-close operations:
        The sum of source closing balances must exactly equal the sum of target period arrears + prepayments.
        """
        # Create active voteheads
        tuition = self.tuition_alpha
        transport = self.transport_alpha

        # Seed balances with arrears on tuition (+4000) and prepayment on transport (-500)
        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=tuition,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('5000.00'),
            amount_paid=Decimal('1000.00'),
            closing_balance=Decimal('4000.00'),
        )
        FeeBalance.objects.create(
            school=self.school_alpha,
            student=self.student_alpha,
            vote_head=transport,
            year=2026,
            term=1,
            opening_balance=Decimal('0.00'),
            amount_invoiced=Decimal('1000.00'),
            amount_paid=Decimal('1500.00'),
            closing_balance=Decimal('-500.00'),
        )

        # Total sum of source closing balances: Tuition = 4000, Transport = -500. Total = 3500
        # Under term-close rules:
        # positive balances collapse to an 'Arrears' votehead in the new term (4000)
        # negative balances collapse to 'Prepayment' in the new term (-500)
        self.client.force_authenticate(self.user_alpha)
        response = self.client.post('/api/finance/term-close/rollover/', {'year': 2026, 'term': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        arrears_v = VoteHead.objects.get(school=self.school_alpha, name='Arrears')
        prepayment_v = VoteHead.objects.get(school=self.school_alpha, name='Prepayment')

        arrears_bal = FeeBalance.objects.get(
            school=self.school_alpha, student=self.student_alpha, vote_head=arrears_v, year=2026, term=2
        )
        prepayment_bal = FeeBalance.objects.get(
            school=self.school_alpha, student=self.student_alpha, vote_head=prepayment_v, year=2026, term=2
        )

        # Confirm exact mathematical conservation of resources
        self.assertEqual(arrears_bal.opening_balance, Decimal('4000.00'))
        self.assertEqual(prepayment_bal.opening_balance, Decimal('-500.00'))
        self.assertEqual(arrears_bal.opening_balance + prepayment_bal.opening_balance, Decimal('3500.00'))
