import uuid
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.schools.models import CommunicationType, Lead, LeadStage, OnboardingProgress, OnboardingStep, School, SchoolStatus, TaskStatus
from apps.schools.services import (
	calculate_school_health_score,
	change_staff_role,
	create_follow_up,
	detect_upsell_opportunities,
	find_available_staff,
	get_notification_records,
	get_school_health_overview,
	get_todays_follow_ups,
	get_role_change_impact,
	get_staff_workload,
	identify_at_risk_schools,
	initialize_school_onboarding,
	log_communication,
	preview_notification_template,
	process_due_follow_ups,
	convert_lead_to_school,
	create_lead,
	get_onboarding_progress_snapshot,
	process_onboarding_step,
	send_notification,
	snooze_follow_up,
	transfer_school_assignment,
	transition_lead_stage,
	update_school_task_status,
)


User = get_user_model()


class SchoolSaaSPhase1Tests(TestCase):
	def setUp(self):
		self.staff = User.objects.create_user(
			username='ops-user',
			email='ops@example.com',
			password='testpass123',
			first_name='Ops',
			last_name='User',
			role='manager',
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.staff)

	def test_lead_conversion_service_initializes_onboarding_and_logs_activity(self):
		lead = create_lead(
			staff_id=self.staff.id,
			school_name='Springfield Academy',
			school_email='hello@springfield.test',
			source='referral',
		)

		school, progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.staff.id)

		school.refresh_from_db()
		lead.refresh_from_db()
		progress.refresh_from_db()

		self.assertEqual(school.status, SchoolStatus.ONBOARDING)
		self.assertEqual(lead.stage, LeadStage.WON)
		self.assertIsNotNone(lead.converted_at)
		self.assertEqual(progress.current_step, OnboardingStep.BASIC_INFO)
		self.assertEqual(progress.tasks.count(), 8)
		self.assertTrue(school.activity_logs.filter(action='lead_converted').exists())

	def test_lead_stage_transition_to_won_auto_converts_school(self):
		lead = create_lead(staff_id=self.staff.id, school_name='Winners School')

		transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.CONTACTED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.DEMO_SCHEDULED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.DEMO_COMPLETED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.NEGOTIATION)
		transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.CONTRACT_SENT)
		result = transition_lead_stage(lead_id=lead.id, staff_id=self.staff.id, new_stage=LeadStage.WON)

		lead.refresh_from_db()
		school = lead.school
		school.refresh_from_db()

		self.assertEqual(lead.stage, LeadStage.WON)
		self.assertEqual(school.status, SchoolStatus.ONBOARDING)
		self.assertIsNotNone(result['onboarding_progress'])
		self.assertTrue(school.tasks.filter(metadata__calendar_task=True).exists())

	def test_onboarding_step_and_task_completion_advance_progress(self):
		lead = create_lead(staff_id=self.staff.id, school_name='Progress Academy')
		school, progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.staff.id)

		process_onboarding_step(
			school_id=school.id,
			staff_id=self.staff.id,
			step=OnboardingStep.BASIC_INFO,
			step_data={'address': 'Nairobi', 'contact': '0712345678'},
		)

		basic_tasks = progress.tasks.filter(step=OnboardingStep.BASIC_INFO)
		for task in basic_tasks:
			update_school_task_status(
				school_id=school.id,
				task_id=task.id,
				staff_id=self.staff.id,
				status=TaskStatus.COMPLETE,
			)

		snapshot = get_onboarding_progress_snapshot(school_id=school.id)

		self.assertEqual(snapshot['current_step'], OnboardingStep.PLAN_SELECTION)
		self.assertGreaterEqual(snapshot['percentage_complete'], 14)
		self.assertEqual(snapshot['completed_steps'][0]['step'], OnboardingStep.BASIC_INFO)

	def test_convert_endpoint_returns_school_and_onboarding_payload(self):
		lead = create_lead(staff_id=self.staff.id, school_name='API School')

		response = self.client.post(f'/api/schools/leads/{lead.id}/convert/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['school']['status'], SchoolStatus.ONBOARDING)
		self.assertEqual(response.data['onboarding_progress']['current_step'], OnboardingStep.BASIC_INFO)

	def test_initialize_onboarding_for_direct_school_creation_creates_lead_progress_and_log(self):
		school = School.objects.create(
			name='Direct Flow Academy',
			email='direct@example.com',
		)

		result = initialize_school_onboarding(school_id=school.id, staff_id=self.staff.id, source='saas_dashboard')

		school.refresh_from_db()
		self.assertEqual(school.status, SchoolStatus.ONBOARDING)
		self.assertEqual(result['lead'].stage, LeadStage.WON)
		self.assertEqual(result['onboarding_progress'].current_step, OnboardingStep.BASIC_INFO)
		self.assertTrue(school.activity_logs.filter(action='school_onboarding_initialized').exists())

	def test_initialize_onboarding_endpoint_returns_existing_school_workflow_payload(self):
		school = School.objects.create(
			name='API Direct Academy',
			email='apidirect@example.com',
		)

		response = self.client.post(f'/api/schools/{school.id}/initialize-onboarding/', {'source': 'saas_dashboard'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['school']['status'], SchoolStatus.ONBOARDING)
		self.assertEqual(response.data['lead']['stage'], LeadStage.WON)
		self.assertEqual(response.data['onboarding_progress']['current_step'], OnboardingStep.BASIC_INFO)

	@patch('apps.users.authentication.requests.get')
	@override_settings(SUPABASE_PROJECT_URL='https://example.supabase.co', SUPABASE_ANON_KEY='test-anon-key')
	def test_initialize_onboarding_endpoint_accepts_supabase_bearer_token(self, mock_requests_get):
		auth_user_id = uuid.uuid4()
		self.staff.auth_user_id = auth_user_id
		self.staff.save(update_fields=['auth_user_id'])

		school = School.objects.create(
			name='Bearer Direct Academy',
			email='bearer@example.com',
		)

		mock_response = Mock()
		mock_response.status_code = 200
		mock_response.json.return_value = {
			'id': str(auth_user_id),
			'email': self.staff.email,
		}
		mock_requests_get.return_value = mock_response

		client = APIClient()
		client.credentials(HTTP_AUTHORIZATION='Bearer supabase-access-token')

		response = client.post(f'/api/schools/{school.id}/initialize-onboarding/', {'source': 'saas_dashboard'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['school']['status'], SchoolStatus.ONBOARDING)
		self.assertEqual(response.data['lead']['stage'], LeadStage.WON)
		self.assertTrue(School.objects.get(pk=school.id).activity_logs.filter(action='school_onboarding_initialized').exists())

	def test_transactional_onboard_endpoint_creates_school_subscription_and_progress(self):
		response = self.client.post(
			'/api/schools/onboard/',
			{
				'name': 'Transactional Academy',
				'email': 'transactional@example.com',
				'phone': '0712345678',
				'address': 'Nairobi',
				'city': 'Nairobi',
				'country': 'Kenya',
				'plan': 'starter',
				'contact_person': 'Test Contact',
				'contact_phone': '0712345678',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 201)
		school = School.objects.get(pk=response.data['school_id'])
		self.assertEqual(school.status, SchoolStatus.ONBOARDING)
		self.assertTrue(Lead.objects.filter(school=school, stage=LeadStage.WON).exists())
		self.assertTrue(OnboardingProgress.objects.filter(school=school, current_step=OnboardingStep.BASIC_INFO).exists())

		table_names = set(connection.introspection.table_names())
		with connection.cursor() as cursor:
			if 'school_settings' in table_names:
				cursor.execute('SELECT COUNT(*) FROM school_settings WHERE school_id = %s', [school.id])
				self.assertEqual(cursor.fetchone()[0], 1)
			if 'subscriptions' in table_names:
				cursor.execute('SELECT COUNT(*) FROM subscriptions WHERE school_id = %s', [school.id])
				self.assertEqual(cursor.fetchone()[0], 1)

	@patch('apps.schools.views.onboard_school_with_workflow', side_effect=DjangoValidationError({'detail': 'boom'}))
	def test_transactional_onboard_endpoint_returns_error_payload(self, _mock_onboard):
		response = self.client.post(
			'/api/schools/onboard/',
			{
				'name': 'Rollback Academy',
				'email': 'rollback@example.com',
				'plan': 'starter',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(School.objects.filter(email='rollback@example.com').exists())

	@patch('apps.schools.views.get_onboarding_progress_snapshot', side_effect=RuntimeError('snapshot failed'))
	def test_transactional_onboard_endpoint_rolls_back_if_response_build_fails(self, _mock_snapshot):
		response = self.client.post(
			'/api/schools/onboard/',
			{
				'name': 'Atomic Response Academy',
				'email': 'atomic-response@example.com',
				'plan': 'starter',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 500)
		self.assertFalse(School.objects.filter(email='atomic-response@example.com').exists())


class SchoolSaaSPhase2Tests(TestCase):
	def setUp(self):
		self.manager = User.objects.create_user(
			username='manager-user',
			email='manager@example.com',
			password='testpass123',
			first_name='Main',
			last_name='Manager',
			role='manager',
		)
		self.sales_rep = User.objects.create_user(
			username='sales-one',
			email='sales1@example.com',
			password='testpass123',
			first_name='Sales',
			last_name='One',
			role='sales_rep',
		)
		self.sales_rep_two = User.objects.create_user(
			username='sales-two',
			email='sales2@example.com',
			password='testpass123',
			first_name='Sales',
			last_name='Two',
			role='sales_rep',
		)
		self.onboarding_specialist = User.objects.create_user(
			username='onboarding-one',
			email='onboarding1@example.com',
			password='testpass123',
			first_name='Onboard',
			last_name='One',
			role='onboarding_specialist',
		)
		self.onboarding_specialist_two = User.objects.create_user(
			username='onboarding-two',
			email='onboarding2@example.com',
			password='testpass123',
			first_name='Onboard',
			last_name='Two',
			role='onboarding_specialist',
		)
		self.account_manager = User.objects.create_user(
			username='account-one',
			email='account1@example.com',
			password='testpass123',
			first_name='Account',
			last_name='Manager',
			role='account_manager',
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.manager)

	def test_staff_workload_reports_role_capacity_and_counts(self):
		active_lead = create_lead(
			staff_id=self.manager.id,
			school_name='Lead One',
			assigned_to_id=self.sales_rep.id,
		)
		closed_lead = create_lead(
			staff_id=self.manager.id,
			school_name='Lead Two',
			assigned_to_id=self.sales_rep.id,
		)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.CONTACTED)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.DEMO_SCHEDULED)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.DEMO_COMPLETED)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.NEGOTIATION)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.CONTRACT_SENT)
		transition_lead_stage(lead_id=closed_lead.id, staff_id=self.manager.id, new_stage=LeadStage.LOST, loss_reason='Budget freeze')

		workload = get_staff_workload(staff_id=self.sales_rep.id)

		self.assertEqual(workload['role'], 'sales_rep')
		self.assertEqual(workload['active_lead_count'], 1)
		self.assertEqual(workload['lead_counts'][LeadStage.LOST], 1)
		self.assertEqual(workload['capacity_limit'], 50)
		self.assertEqual(workload['capacity_used_percent'], 2.0)
		self.assertIsNotNone(workload['recent_assignment_at'])
		self.assertEqual(active_lead.assigned_to_id, self.sales_rep.id)

	def test_find_available_staff_prefers_lowest_load_then_oldest_assignment(self):
		lead_one = create_lead(
			staff_id=self.manager.id,
			school_name='Availability One',
			assigned_to_id=self.sales_rep.id,
		)
		lead_two = create_lead(
			staff_id=self.manager.id,
			school_name='Availability Two',
			assigned_to_id=self.sales_rep.id,
		)
		lead_three = create_lead(
			staff_id=self.manager.id,
			school_name='Availability Three',
			assigned_to_id=self.sales_rep_two.id,
		)
		lead_three.last_assigned_at = lead_three.created_at
		lead_three.save(update_fields=['last_assigned_at'])
		lead_one.last_assigned_at = lead_one.created_at
		lead_one.save(update_fields=['last_assigned_at'])
		lead_two.last_assigned_at = lead_two.created_at + timezone.timedelta(minutes=5)
		lead_two.save(update_fields=['last_assigned_at'])

		available = find_available_staff(role='sales_rep')

		self.assertEqual(available['staff_id'], self.sales_rep_two.id)
		self.assertFalse(available['fallback_used'])
		self.assertEqual(available['workload']['current_load'], 1)

	def test_transfer_school_assignment_reassigns_school_tasks_and_logs_activity(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Transfer Academy',
			assigned_to_id=self.onboarding_specialist.id,
		)
		school, progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.onboarding_specialist.id)

		transfer_result = transfer_school_assignment(
			school_id=school.id,
			initiated_by_id=self.manager.id,
			target_staff_id=self.onboarding_specialist_two.id,
			reason='workload_balancing',
			notes='Reduce onboarding queue',
			transfer_items=['all_school_data', 'active_tasks'],
			reassign_open_tasks=True,
			schedule_intro_call=True,
		)

		school.refresh_from_db()
		progress.refresh_from_db()

		self.assertEqual(school.assigned_staff_id, self.onboarding_specialist_two.id)
		self.assertEqual(progress.assigned_to_id, self.onboarding_specialist_two.id)
		self.assertTrue(all(task.assigned_to_id == self.onboarding_specialist_two.id for task in school.tasks.exclude(status=TaskStatus.COMPLETE)))
		self.assertEqual(school.details['transfers'][-1]['to_staff_id'], self.onboarding_specialist_two.id)
		self.assertTrue(school.activity_logs.filter(action='school_transferred').exists())
		self.assertIsNotNone(transfer_result['intro_call_task_id'])

	def test_transfer_endpoint_returns_updated_assignment_payload(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Transfer API Academy',
			assigned_to_id=self.onboarding_specialist.id,
		)
		school, _progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.onboarding_specialist.id)

		response = self.client.post(
			f'/api/schools/{school.id}/transfer/',
			{
				'target_staff_id': self.onboarding_specialist_two.id,
				'reason': 'workload_balancing',
				'notes': 'Transfer from API test',
				'transfer_items': ['all_school_data', 'active_tasks'],
				'reassign_open_tasks': True,
				'schedule_intro_call': True,
			},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['school']['assigned_staff'], self.onboarding_specialist_two.id)
		self.assertTrue(len(response.data['transferred_task_ids']) >= 1)
		self.assertIsNotNone(response.data['intro_call_task_id'])

	def test_role_change_preview_identifies_mismatched_assignments(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Role Preview Lead',
			assigned_to_id=self.sales_rep.id,
		)
		onboarding_lead = create_lead(
			staff_id=self.manager.id,
			school_name='Role Preview Onboarding',
			assigned_to_id=self.sales_rep.id,
		)
		convert_lead_to_school(lead_id=onboarding_lead.id, staff_id=self.onboarding_specialist.id)

		impact = get_role_change_impact(staff_id=self.sales_rep.id, new_role='account_manager')

		self.assertEqual(impact['current_role'], 'sales_rep')
		self.assertEqual(impact['new_role'], 'account_manager')
		self.assertEqual(impact['summary']['mismatched_lead_count'], 1)
		self.assertEqual(impact['mismatched_assignments']['active_leads'][0]['lead_id'], lead.id)

	def test_role_change_auto_reassign_updates_role_and_assignments(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Role Change Lead',
			assigned_to_id=self.sales_rep.id,
		)
		onboarding_lead = create_lead(
			staff_id=self.manager.id,
			school_name='Role Change Onboarding',
			assigned_to_id=self.sales_rep.id,
		)
		school, _progress = convert_lead_to_school(lead_id=onboarding_lead.id, staff_id=self.onboarding_specialist.id)
		school.assigned_staff = self.sales_rep
		school.save(update_fields=['assigned_staff', 'updated_at'])

		result = change_staff_role(
			staff_id=self.sales_rep.id,
			initiated_by_id=self.manager.id,
			new_role='account_manager',
			strategy='auto_reassign',
			target_staff_ids={
				'lead_target_staff_id': self.sales_rep_two.id,
				'onboarding_target_staff_id': self.onboarding_specialist_two.id,
			},
			notes='Promoting to onboarding team',
		)

		self.sales_rep.refresh_from_db()
		lead.refresh_from_db()
		school.refresh_from_db()

		self.assertEqual(self.sales_rep.role, 'account_manager')
		self.assertEqual(lead.assigned_to_id, self.sales_rep_two.id)
		self.assertEqual(school.assigned_staff_id, self.onboarding_specialist_two.id)
		self.assertIn(lead.id, result['reassigned_assignments']['lead_ids'])
		self.assertIn(school.id, result['reassigned_assignments']['school_ids'])

	def test_role_change_keep_with_manager_approval_preserves_selected_assignments(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Keep Approval Lead',
			assigned_to_id=self.sales_rep.id,
		)

		result = change_staff_role(
			staff_id=self.sales_rep.id,
			initiated_by_id=self.manager.id,
			new_role='account_manager',
			strategy='keep_with_manager_approval',
			keep_lead_ids=[lead.id],
			notes='Temporary overlap approved by manager',
		)

		self.sales_rep.refresh_from_db()
		lead.refresh_from_db()

		self.assertEqual(self.sales_rep.role, 'account_manager')
		self.assertEqual(lead.assigned_to_id, self.sales_rep.id)
		self.assertIn(lead.id, result['kept_assignments']['lead_ids'])

	def test_role_change_preview_and_execute_endpoints_work(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Role API Lead',
			assigned_to_id=self.sales_rep.id,
		)

		preview_response = self.client.get(
			f'/api/users/{self.sales_rep.id}/role-change/preview/',
			{'new_role': 'account_manager'},
		)
		self.assertEqual(preview_response.status_code, 200)
		self.assertEqual(preview_response.data['summary']['mismatched_lead_count'], 1)

		execute_response = self.client.post(
			f'/api/users/{self.sales_rep.id}/role-change/',
			{
				'new_role': 'account_manager',
				'strategy': 'auto_reassign',
				'lead_target_staff_id': self.sales_rep_two.id,
				'notes': 'API triggered role change',
			},
			format='json',
		)
		self.assertEqual(execute_response.status_code, 200)
		self.assertEqual(execute_response.data['user']['role'], 'account_manager')
		lead.refresh_from_db()
		self.assertEqual(lead.assigned_to_id, self.sales_rep_two.id)


class SchoolSaaSPhase3Tests(TestCase):
	def setUp(self):
		self.manager = User.objects.create_user(
			username='health-manager',
			email='health.manager@example.com',
			password='testpass123',
			first_name='Health',
			last_name='Manager',
			role='manager',
		)
		self.account_manager = User.objects.create_user(
			username='health-account',
			email='health.account@example.com',
			password='testpass123',
			first_name='Health',
			last_name='Account',
			role='account_manager',
		)
		self.school_admin = User.objects.create_user(
			username='school-admin',
			email='school.admin@example.com',
			password='testpass123',
			first_name='School',
			last_name='Admin',
			role='admin',
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.manager)

		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Health Academy',
			assigned_to_id=self.account_manager.id,
		)
		self.school, self.progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.account_manager.id)
		self.school.status = SchoolStatus.ACTIVE
		self.school.assigned_staff = self.account_manager
		self.school.details = {
			'billing': {
				'payment_status': 'active',
				'renewal_date': (timezone.now() + timezone.timedelta(days=45)).isoformat(),
				'payment_method_valid': True,
			},
			'plan': {
				'student_limit': 10,
				'teacher_limit': 5,
				'storage_limit_mb': 100,
				'current_storage_mb': 90,
			},
		}
		self.school.save(update_fields=['status', 'assigned_staff', 'details', 'updated_at'])
		self.school_admin.school = self.school
		self.school_admin.last_login = timezone.now()
		self.school_admin.save(update_fields=['school', 'last_login'])
		self.progress.completed_steps = {
			OnboardingStep.TRAINING: {
				'completed_at': timezone.now().isoformat(),
				'completed_by_id': self.account_manager.id,
			}
		}
		self.progress.save(update_fields=['completed_steps', 'updated_at'])

		from apps.students.models import Class, Stream, Student
		from apps.teachers.models import Teacher
		from apps.attendance.models import Attendance
		from apps.exams.models import Exam, ExamType
		from apps.grading.models import Score
		from apps.subjects.models import Subject
		from apps.settings.models import TermSetting
		from apps.fees.models import PaymentTransaction

		class_obj = Class.objects.create(school=self.school, name='Grade 7', grade_level=7)
		stream = Stream.objects.create(school=self.school, class_assigned=class_obj, name='A')
		subject = Subject.objects.create(name='Math', code='MAT7')
		term = TermSetting.objects.create(school=self.school, year=timezone.now().year, term=1, start_date=timezone.now().date(), end_date=(timezone.now() + timezone.timedelta(days=30)).date())
		exam_type = ExamType.objects.create(school=self.school, name='Mid Term')
		exam = Exam.objects.create(
			school=self.school,
			name='Mid Term Maths',
			exam_type=exam_type,
			subject=subject,
			class_assigned=class_obj,
			stream=stream,
			term=term,
			academic_year=timezone.now().year,
			exam_date=timezone.now().date(),
			created_by=self.manager,
		)

		for idx in range(1, 10):
			student = Student.objects.create(
				school=self.school,
				admission_number=f'{timezone.now().year}-{idx:04d}',
				level='LS',
				full_name=f'Student {idx}',
				gender='M',
				date_of_birth=timezone.now().date() - timezone.timedelta(days=3650),
				current_class=class_obj,
				current_stream=stream,
				guardian_name='Guardian Name',
				guardian_phone='+254700000000',
			)
			Attendance.objects.create(school=self.school, student=student, date=timezone.now().date(), time_in=timezone.now().time())
			Score.objects.create(student=student, exam=exam, marks=75, entered_by=self.manager)
			PaymentTransaction.objects.create(school=self.school, student=student, amount=1000, mode='cash')

		Teacher.objects.create(
			school=self.school,
			first_name='Jane',
			last_name='Doe',
			tsc_number='TSC12345',
			gender='F',
			date_of_birth=timezone.now().date() - timezone.timedelta(days=10000),
			phone='+254711111111',
			email='teacher@example.com',
			job_title='Teacher',
		)

	def test_calculate_school_health_score_creates_snapshot_and_history(self):
		snapshot = calculate_school_health_score(school_id=self.school.id, actor_id=self.manager.id)
		overview = get_school_health_overview(school_id=self.school.id)

		self.assertGreater(snapshot.health_score, 0)
		self.assertEqual(overview['latest_snapshot']['id'], snapshot.id)
		self.assertEqual(len(overview['history']), 1)
		self.assertTrue(self.school.activity_logs.filter(action='school_health_calculated').exists())

	def test_identify_at_risk_schools_creates_retention_task(self):
		self.school.details['billing']['payment_status'] = 'past_due'
		self.school.save(update_fields=['details', 'updated_at'])
		self.school_admin.last_login = timezone.now() - timezone.timedelta(days=45)
		self.school_admin.save(update_fields=['last_login'])
		calculate_school_health_score(school_id=self.school.id, actor_id=self.manager.id)

		results = identify_at_risk_schools(actor_id=self.manager.id)

		self.assertEqual(len(results), 1)
		self.assertIn('payment_failure', results[0]['risk_flags'])
		self.assertTrue(self.school.tasks.filter(title='Contact school regarding low engagement').exists())

	def test_detect_upsell_opportunities_creates_expected_records(self):
		calculate_school_health_score(school_id=self.school.id, actor_id=self.manager.id)

		opportunities = detect_upsell_opportunities(school_id=self.school.id, actor_id=self.manager.id)

		trigger_types = {item['trigger_type'] for item in opportunities}
		self.assertIn('student_limit_90_percent', trigger_types)
		self.assertIn('storage_high_usage', trigger_types)
		self.assertTrue(self.school.activity_logs.filter(action='upsell_opportunity_detected').exists())

	def test_health_and_upsell_endpoints_return_payloads(self):
		health_response = self.client.post(f'/api/schools/{self.school.id}/health/calculate/')
		self.assertEqual(health_response.status_code, 200)
		overview_response = self.client.get(f'/api/schools/{self.school.id}/health/')
		self.assertEqual(overview_response.status_code, 200)

		upsell_response = self.client.post(f'/api/schools/{self.school.id}/upsell/detect/')
		self.assertEqual(upsell_response.status_code, 200)
		at_risk_response = self.client.get('/api/schools/health/at-risk/')
		self.assertEqual(at_risk_response.status_code, 200)


class SchoolSaaSPhase4Tests(TestCase):
	def setUp(self):
		self.manager = User.objects.create_user(
			username='phase4-manager',
			email='phase4.manager@example.com',
			password='testpass123',
			first_name='Phase',
			last_name='Manager',
			role='manager',
		)
		self.account_manager = User.objects.create_user(
			username='phase4-account',
			email='phase4.account@example.com',
			password='testpass123',
			first_name='Phase',
			last_name='Account',
			role='account_manager',
		)
		self.school_admin = User.objects.create_user(
			username='phase4-school-admin',
			email='phase4.school@example.com',
			password='testpass123',
			first_name='Phase',
			last_name='School',
			role='admin',
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.manager)

		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Communication Academy',
			assigned_to_id=self.account_manager.id,
		)
		self.school, self.progress = convert_lead_to_school(lead_id=lead.id, staff_id=self.account_manager.id)
		self.school.status = SchoolStatus.ACTIVE
		self.school.assigned_staff = self.account_manager
		self.school.save(update_fields=['status', 'assigned_staff', 'updated_at'])
		self.school_admin.school = self.school
		self.school_admin.save(update_fields=['school'])

	def test_communication_logging_creates_timeline_and_follow_up(self):
		response = self.client.post(
			'/api/schools/communications/',
			{
				'school_id': self.school.id,
				'communication_type': CommunicationType.MEETING,
				'direction': 'OUTBOUND',
				'subject': 'Kickoff meeting',
				'content': 'Reviewed launch agenda and next steps.',
				'participants': [{'name': 'Principal', 'role': 'school_admin'}],
				'follow_up_required': True,
				'follow_up_due_at': (timezone.now() + timezone.timedelta(days=2)).isoformat(),
				'follow_up_title': 'Send kickoff recap',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data['communication']['subject'], 'Kickoff meeting')
		self.assertIsNotNone(response.data['follow_up'])

		list_response = self.client.get(
			'/api/schools/communications/',
			{'school_id': self.school.id, 'search': 'Kickoff'},
		)
		self.assertEqual(list_response.status_code, 200)
		self.assertEqual(len(list_response.data), 1)
		self.assertTrue(self.school.activity_logs.filter(action='communication_logged').exists())

	def test_notification_preview_and_send_create_records(self):
		task = self.school.tasks.first()
		preview = preview_notification_template(
			template_key='task_assigned',
			variables={'taskName': task.title, 'schoolName': self.school.name},
		)

		self.assertIn(task.title, preview['subject'])

		preview_response = self.client.post(
			'/api/schools/notifications/preview/',
			{
				'template_key': 'task_assigned',
				'variables': {'taskName': task.title, 'schoolName': self.school.name},
			},
			format='json',
		)
		self.assertEqual(preview_response.status_code, 200)

		send_response = self.client.post(
			'/api/schools/notifications/send/',
			{
				'school_id': self.school.id,
				'recipient_id': self.account_manager.id,
				'template_key': 'task_assigned',
				'task_id': task.id,
				'variables': {'taskName': task.title, 'schoolName': self.school.name},
			},
			format='json',
		)
		self.assertEqual(send_response.status_code, 201)
		self.assertGreaterEqual(len(send_response.data), 1)
		notifications = get_notification_records(school_id=self.school.id, recipient_id=self.account_manager.id)
		self.assertTrue(any(item.template_key == 'task_assigned' for item in notifications))

	def test_lead_stage_follow_ups_are_scheduled_for_demo_and_loss(self):
		lead = create_lead(
			staff_id=self.manager.id,
			school_name='Pipeline Academy',
			assigned_to_id=self.account_manager.id,
		)

		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.CONTACTED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.DEMO_SCHEDULED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.DEMO_COMPLETED)
		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.NEGOTIATION)
		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.CONTRACT_SENT)
		transition_lead_stage(lead_id=lead.id, staff_id=self.manager.id, new_stage=LeadStage.LOST, loss_reason='No budget')

		follow_ups = self.account_manager.assigned_follow_ups.filter(school=lead.school)
		self.assertTrue(follow_ups.filter(title__icontains='demo').exists())
		self.assertTrue(follow_ups.filter(title__icontains='Re-engage').exists())

	def test_due_follow_up_processing_snooze_complete_and_today_views(self):
		overdue_follow_up = create_follow_up(
			school=self.school,
			created_by=self.manager,
			assigned_to=self.account_manager,
			title='Overdue renewal call',
			description='Call the school about renewal.',
			due_at=timezone.now() - timezone.timedelta(days=4),
		)
		today_follow_up = create_follow_up(
			school=self.school,
			created_by=self.manager,
			assigned_to=self.manager,
			title='Today follow-up',
			description='Review today items.',
			due_at=timezone.now() + timezone.timedelta(hours=1),
		)

		results = process_due_follow_ups(actor_id=self.manager.id)

		self.assertIn(overdue_follow_up.id, results['processed_follow_up_ids'])
		self.assertIn(overdue_follow_up.id, results['escalated_follow_up_ids'])
		self.assertTrue(any(item.template_key == 'follow_up_due' for item in get_notification_records(recipient_id=self.account_manager.id)))

		today_items = get_todays_follow_ups(staff_id=self.manager.id)
		self.assertTrue(any(item.id == today_follow_up.id for item in today_items))

		today_response = self.client.get('/api/schools/follow-ups/today/')
		self.assertEqual(today_response.status_code, 200)
		self.assertEqual(len(today_response.data), 1)

		snooze_response = self.client.post(
			f'/api/schools/follow-ups/{today_follow_up.id}/snooze/',
			{'days': 3},
			format='json',
		)
		self.assertEqual(snooze_response.status_code, 200)

		complete_response = self.client.post(
			f'/api/schools/follow-ups/{today_follow_up.id}/complete/',
			{'notes': 'Handled after review.'},
			format='json',
		)
		self.assertEqual(complete_response.status_code, 200)
		today_follow_up.refresh_from_db()
		self.assertEqual(today_follow_up.status, 'COMPLETE')
