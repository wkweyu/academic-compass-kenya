from .models import VoteHead,FeeBalance

def apportion_payment(school, student, payment_amount):
    vote_heads = VoteHead.objects.filter(
        school=school,
        fee_applicable=True
    ).order_by('priority')

    allocations = []
    remaining = payment_amount

    for vh in vote_heads:
        if remaining <= 0:
            break
        expected_balance = get_student_balance_for_votehead(student, vh)
        if expected_balance > 0:
            allocate = min(remaining, expected_balance)
            allocations.append({'vote_head': vh.name, 'amount': allocate})
            remaining -= allocate

    return allocations

# Dummy placeholder, replace with your fee balance lookup logic
def get_student_balance_for_votehead(student, vote_head):
    # e.g fetch from transaction logs, invoices, or fee balances
    return 10000  # placeholder



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
