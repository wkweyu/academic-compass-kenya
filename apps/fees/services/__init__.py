
# apportion_payment and apply_payment_to_balances moved here from services.py
from decimal import Decimal

from django.db.models import Sum

from apps.fees.models import VoteHead, FeeBalance


def apportion_payment(school, student, payment_amount, year=None, term=None):
	vote_heads = list(
		VoteHead.objects.filter(
			school=school,
			fee_applicable=True
		).order_by('priority')
	)

	allocations = []
	remaining = payment_amount

	for vote_head in vote_heads:
		if remaining <= 0:
			break
		expected_balance = get_student_balance_for_votehead(
			school,
			student,
			vote_head,
			year=year,
			term=term,
		)
		if expected_balance > 0:
			allocate = min(remaining, expected_balance)
			allocations.append({'vote_head': vote_head.name, 'amount': allocate})
			remaining -= allocate

	# Preserve full-allocation behavior while keeping excess away from
	# zero/negative-balance voteheads: carry any extra to the highest-priority
	# applicable votehead as an advance/prepayment.
	if remaining > 0 and vote_heads:
		if allocations:
			allocations[0]['amount'] += remaining
		else:
			allocations.append({'vote_head': vote_heads[0].name, 'amount': remaining})

	return allocations


def get_student_balance_for_votehead(school, student, vote_head, year=None, term=None):
	balance_qs = FeeBalance._base_manager.filter(
		school=school,
		student=student,
		vote_head=vote_head,
	)
	if year is not None:
		balance_qs = balance_qs.filter(year=year)
	if term is not None:
		balance_qs = balance_qs.filter(term=term)

	outstanding = balance_qs.aggregate(total=Sum('closing_balance')).get('total') or Decimal('0.00')
	return outstanding if outstanding > 0 else Decimal('0.00')

def apply_payment_to_balances(school, student, year, term, allocations):
	for item in allocations:
		vote_head_name = item['vote_head']
		amount_paid = item['amount']

		vote_head = VoteHead.objects.get(school=school, name=vote_head_name)
		balance, created = FeeBalance.objects.get_or_create(
			school=school,
			student=student,
			vote_head=vote_head,
			year=year,
			term=term,
			defaults={'opening_balance': 0, 'amount_invoiced': 0, 'amount_paid': 0}
		)

		balance.amount_paid += amount_paid
		balance.update_balance()

from django.utils import timezone
def log_finance_activity(school, user, action, object_id=None, details=None, result=None, message=None):
	"""
	Utility to log finance-related actions for auditability.
	Args:
		school (School): School instance
		user (User): User instance (can be None)
		action (str): Action type (must match FinanceActivityLog.ACTION_CHOICES)
		object_id (str, optional): ID of the affected object
		details (dict, optional): Additional context or parameters
		result (str, optional): Result status (e.g., SUCCESS, FAILURE)
		message (str, optional): Optional message or error details
	Returns:
		FinanceActivityLog: The created log entry
	"""
	from apps.fees.models import FinanceActivityLog
	log = FinanceActivityLog.objects.create(
		school=school,
		user=user,
		action=action,
		timestamp=timezone.now(),
		object_id=object_id or '',
		details=details or {},
		result=result or '',
		message=message or ''
	)
	return log
