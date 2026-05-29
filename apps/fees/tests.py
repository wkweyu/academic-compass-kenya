from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from apps.fees.models import FeeBalance, ScheduledExportJob, TermCloseConversionDetail, TermClosePeriod, VoteHead
from apps.schools.models import ActivityLog, School
from apps.students.models import Student
from apps.users.models import User


class TermCloseFinanceAPITests(APITestCase):
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
			admission_number='ADM-ALPHA-001',
			level='LP',
			full_name='Jane Alpha',
			gender='F',
			date_of_birth=date(2014, 5, 10),
			guardian_name='Parent Alpha',
			guardian_phone='0712345678',
			admission_year=2026,
		)
		self.other_student = Student.objects.create(
			school=self.other_school,
			admission_number='ADM-BETA-001',
			level='LP',
			full_name='John Beta',
			gender='M',
			date_of_birth=date(2014, 8, 20),
			guardian_name='Parent Beta',
			guardian_phone='0712345679',
			admission_year=2026,
		)

		self.tuition = VoteHead.objects.create(school=self.school, name='Tuition', priority=1)
		self.transport = VoteHead.objects.create(school=self.school, name='Transport', priority=2)
		self.other_votehead = VoteHead.objects.create(school=self.other_school, name='Tuition', priority=1)

	def _seed_source_balances(self):
		# +2000 arrears from tuition, -500 prepayment from transport.
		FeeBalance.objects.create(
			school=self.school,
			student=self.student,
			vote_head=self.tuition,
			year=2026,
			term=1,
			opening_balance=Decimal('1000.00'),
			amount_invoiced=Decimal('2000.00'),
			amount_paid=Decimal('1000.00'),
			closing_balance=Decimal('2000.00'),
		)
		FeeBalance.objects.create(
			school=self.school,
			student=self.student,
			vote_head=self.transport,
			year=2026,
			term=1,
			opening_balance=Decimal('0.00'),
			amount_invoiced=Decimal('1000.00'),
			amount_paid=Decimal('1500.00'),
			closing_balance=Decimal('-500.00'),
		)

	def test_term_close_preview_returns_expected_totals(self):
		self._seed_source_balances()

		response = self.client.get('/api/finance/term-close/preview/', {'year': 2026, 'term': 1})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['source_period'], {'year': 2026, 'term': 1})
		self.assertEqual(response.data['target_period'], {'year': 2026, 'term': 2})
		self.assertEqual(response.data['totals']['students_affected'], 1)
		self.assertEqual(Decimal(str(response.data['totals']['arrears'])), Decimal('2000.0'))
		self.assertEqual(Decimal(str(response.data['totals']['prepayment'])), Decimal('-500.0'))
		self.assertEqual(len(response.data['students']), 1)
		self.assertEqual(len(response.data['students'][0]['sources']), 2)

	def test_rollover_creates_collapsed_brought_forward_rows_and_conversion_trace(self):
		self._seed_source_balances()

		response = self.client.post('/api/finance/term-close/rollover/', {'year': 2026, 'term': 1}, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['target_period'], {'year': 2026, 'term': 2})
		self.assertEqual(response.data['rows_processed'], 1)

		period = TermClosePeriod.objects.get(school=self.school, year=2026, term=1)
		self.assertEqual(period.status, 'CLOSED')
		self.assertEqual(period.rows_processed, 1)

		arrears_votehead = VoteHead.objects.get(school=self.school, name='Arrears')
		prepayment_votehead = VoteHead.objects.get(school=self.school, name='Prepayment')

		arrears_balance = FeeBalance.objects.get(
			school=self.school,
			student=self.student,
			vote_head=arrears_votehead,
			year=2026,
			term=2,
		)
		prepayment_balance = FeeBalance.objects.get(
			school=self.school,
			student=self.student,
			vote_head=prepayment_votehead,
			year=2026,
			term=2,
		)

		self.assertEqual(arrears_balance.opening_balance, Decimal('2000.00'))
		self.assertEqual(prepayment_balance.opening_balance, Decimal('-500.00'))

		details = TermCloseConversionDetail.objects.filter(period=period).order_by('target_type', 'source_vote_head__name')
		self.assertEqual(details.count(), 2)
		self.assertEqual(sum(d.source_closing_balance for d in details if d.target_type == 'ARREARS'), Decimal('2000.00'))
		self.assertEqual(sum(d.source_closing_balance for d in details if d.target_type == 'PREPAYMENT'), Decimal('-500.00'))

	def test_rollover_second_run_without_force_is_blocked(self):
		self._seed_source_balances()

		first = self.client.post('/api/finance/term-close/rollover/', {'year': 2026, 'term': 1}, format='json')
		second = self.client.post('/api/finance/term-close/rollover/', {'year': 2026, 'term': 1}, format='json')

		self.assertEqual(first.status_code, status.HTTP_200_OK)
		self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
		self.assertIn('already closed', second.data['detail'].lower())

	def test_conversion_report_is_school_scoped(self):
		self._seed_source_balances()
		self.client.post('/api/finance/term-close/rollover/', {'year': 2026, 'term': 1}, format='json')

		other_period = TermClosePeriod.objects.create(
			school=self.other_school,
			year=2026,
			term=1,
			target_year=2026,
			target_term=2,
			status='CLOSED',
			started_by=self.user,
			closed_by=self.user,
			rows_processed=1,
		)
		TermCloseConversionDetail.objects.create(
			period=other_period,
			school=self.other_school,
			student=self.other_student,
			source_year=2026,
			source_term=1,
			target_year=2026,
			target_term=2,
			source_vote_head=self.other_votehead,
			source_closing_balance=Decimal('999.00'),
			target_type='ARREARS',
			target_amount=Decimal('999.00'),
		)

		response = self.client.get('/api/finance/term-close/conversion-report/', {'year': 2026, 'term': 1})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(response.data['count'], 1)
		self.assertTrue(all(row['student_id'] == self.student.id for row in response.data['results']))

	def test_non_finance_role_is_forbidden(self):
		self._seed_source_balances()
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

		response = self.client.get('/api/finance/term-close/preview/', {'year': 2026, 'term': 1})

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_outstanding_report_returns_positive_balances_only(self):
		self._seed_source_balances()

		response = self.client.get('/api/finance/reports/outstanding/', {'year': 2026, 'term': 1})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['count'], 1)
		self.assertEqual(Decimal(str(response.data['total_outstanding'])), Decimal('2000.0'))
		self.assertEqual(response.data['results'][0]['student_id'], self.student.id)

	def test_student_aging_report_uses_as_of_date_buckets(self):
		self._seed_source_balances()

		response = self.client.get('/api/finance/reports/student-aging/', {'as_of_date': '2026-05-15'})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['as_of_date'], '2026-05-15')
		self.assertEqual(Decimal(str(response.data['totals']['0-30'])), Decimal('2000.0'))
		self.assertEqual(Decimal(str(response.data['totals']['31-60'])), Decimal('0.0'))
		self.assertEqual(Decimal(str(response.data['totals']['61-90'])), Decimal('0.0'))
		self.assertEqual(Decimal(str(response.data['totals']['90+'])), Decimal('0.0'))
		self.assertEqual(response.data['results'][0]['student_id'], self.student.id)
		self.assertTrue(len(response.data['by_class']) >= 1)
		self.assertTrue(len(response.data['by_votehead']) >= 1)
		self.assertEqual(response.data['by_votehead'][0]['vote_head_name'], 'Tuition')

	def test_activity_log_endpoint_records_export_action(self):
		response = self.client.post(
			'/api/finance/activity-log/',
			{
				'action': 'FINANCE_REPORT_EXPORT',
				'description': 'Exported outstanding report.',
				'metadata': {'report_type': 'outstanding_csv'},
			},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertTrue(
			ActivityLog.objects.filter(
				school=self.school,
				action='FINANCE_REPORT_EXPORT',
			).exists()
		)

	def test_collection_effectiveness_report_returns_term_trends(self):
		FeeBalance.objects.create(
			school=self.school,
			student=self.student,
			vote_head=self.tuition,
			year=2026,
			term=1,
			opening_balance=Decimal('0.00'),
			amount_invoiced=Decimal('1000.00'),
			amount_paid=Decimal('700.00'),
			closing_balance=Decimal('300.00'),
		)
		FeeBalance.objects.create(
			school=self.school,
			student=self.student,
			vote_head=self.transport,
			year=2026,
			term=2,
			opening_balance=Decimal('0.00'),
			amount_invoiced=Decimal('2000.00'),
			amount_paid=Decimal('2000.00'),
			closing_balance=Decimal('0.00'),
		)

		response = self.client.get(
			'/api/finance/reports/collection-effectiveness/',
			{'start_year': 2026, 'end_year': 2026},
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['count'], 2)
		self.assertEqual(Decimal(str(response.data['summary']['total_invoiced'])), Decimal('3000.0'))
		self.assertEqual(Decimal(str(response.data['summary']['total_paid'])), Decimal('2700.0'))
		self.assertEqual(Decimal(str(response.data['summary']['overall_collection_rate'])), Decimal('90.00'))

	def test_debt_analytics_report_returns_summary_and_rows(self):
		self._seed_source_balances()

		response = self.client.get('/api/finance/reports/debt-analytics/', {'year': 2026, 'term': 1, 'as_of_date': '2026-05-15'})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['as_of_date'], '2026-05-15')
		self.assertEqual(response.data['count'], 1)
		self.assertEqual(response.data['summary']['students_with_arrears'], 1)
		self.assertEqual(response.data['results'][0]['student_id'], self.student.id)
		self.assertIn(response.data['results'][0]['risk_band'], ['LOW', 'MEDIUM', 'HIGH'])

	def test_activity_log_list_is_scoped_and_filterable(self):
		ActivityLog.objects.create(
			school=self.school,
			actor=self.user,
			action='FINANCE_REPORT_EXPORT',
			description='Exported daily report',
			metadata={'type': 'daily'},
		)
		ActivityLog.objects.create(
			school=self.school,
			actor=self.user,
			action='FINANCE_TERM_CLOSE_COMPLETED',
			description='Closed term',
			metadata={'term': 1},
		)
		ActivityLog.objects.create(
			school=self.other_school,
			actor=self.user,
			action='FINANCE_REPORT_EXPORT',
			description='Other school export',
			metadata={'type': 'other'},
		)

		response = self.client.get('/api/finance/activity-log/', {'action': 'FINANCE_REPORT_EXPORT', 'limit': 10})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['count'], 1)
		self.assertEqual(response.data['results'][0]['action'], 'FINANCE_REPORT_EXPORT')
		self.assertEqual(response.data['results'][0]['description'], 'Exported daily report')

	def test_finance_reports_export_returns_csv(self):
		self._seed_source_balances()

		response = self.client.get(
			'/api/finance/reports/export/',
			{'report': 'outstanding', 'year': 2026, 'term': 1},
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response['Content-Type'], 'text/csv')
		self.assertIn('Admission Number,Student Name,Class,Year,Term,Closing Balance', response.content.decode('utf-8'))

	def test_finance_reports_export_supports_streaming_csv(self):
		self._seed_source_balances()

		response = self.client.get(
			'/api/finance/reports/export/',
			{'report': 'outstanding', 'year': 2026, 'term': 1, 'stream': 'true'},
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response['Content-Type'], 'text/csv')
		stream_bytes = b''.join(response.streaming_content)
		self.assertIn('Admission Number,Student Name,Class,Year,Term,Closing Balance', stream_bytes.decode('utf-8'))

	def test_scheduled_export_create_and_list_materializes_due_job(self):
		response = self.client.post(
			'/api/finance/reports/export-jobs/',
			{
				'report': 'outstanding',
				'run_at': '2026-05-01T09:00:00+03:00',
				'filters': {'year': 2026, 'term': 1},
				'notes': 'Morning bursar export',
			},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['job']['status'], 'SCHEDULED')

		jobs_response = self.client.get('/api/finance/reports/export-jobs/')
		self.assertEqual(jobs_response.status_code, status.HTTP_200_OK)
		self.assertEqual(jobs_response.data['count'], 1)
		self.assertIn(jobs_response.data['results'][0]['status'], ['SCHEDULED', 'READY'])

	def test_scheduled_export_download_and_cancel_flow(self):
		self._seed_source_balances()
		job = ScheduledExportJob.objects.create(
			school=self.school,
			created_by=self.user,
			report='outstanding',
			filters={'year': 2026, 'term': 1},
			run_at=timezone.now() - timedelta(minutes=1),
			status='READY',
		)

		download_response = self.client.get(f'/api/finance/reports/export-jobs/{job.id}/download/')
		self.assertEqual(download_response.status_code, status.HTTP_200_OK)
		self.assertEqual(download_response['Content-Type'], 'text/csv')
		self.assertIn('Admission Number,Student Name,Class,Year,Term,Closing Balance', download_response.content.decode('utf-8'))

		job.refresh_from_db()
		self.assertEqual(job.status, 'COMPLETED')

		cancel_response = self.client.post(f'/api/finance/reports/export-jobs/{job.id}/cancel/', format='json')
		self.assertEqual(cancel_response.status_code, status.HTTP_409_CONFLICT)
