from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.fees.models import PaymentTransaction
from apps.payments.models import PaymentEvent, PaymentIngressLog, SchoolPaymentConfig
from apps.schools.models import ActivityLog, School
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
            ActivityLog.objects.filter(
                school=self.school,
                action='FINANCE_PAYMENT_REPROCESS',
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
