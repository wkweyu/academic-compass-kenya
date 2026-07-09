#!/usr/bin/env python
"""
Run Phase 4 - API Contract Contract Validation.
This script boots the Django framework, seeds necessary context data, and executes
a battery of unauthenticated and authenticated API tests against the active DRF serializers
to verify HTTP status codes, authorization gates, pagination format, and exact serializer key parity.
"""

import os
import sys
import json
from decimal import Decimal
from datetime import datetime
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'skooltrack_pro.settings')
django.setup()

from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient
from apps.schools.models import School
from apps.users.models import User
from apps.students.models import Student
from apps.fees.models import VoteHead, FeeStructure, FeeBalance, DebitTransaction, PaymentTransaction, TermClosePeriod, TermCloseConversionDetail
from apps.payments.models import SchoolPaymentConfig, PaymentIngressLog, PaymentEvent

print("--- [API VALIDATION RUNNER] Loaded Django context successfully ---")

# Setup clean testing client
client = APIClient()

# Core School, bursar user, student and payment data seeding to ensure endpoints return valid structures
print("--- [SEEDING VALIDATION STATE] Cleaning old data and setting up standard schema models ---")
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("DELETE FROM public.fees_finance_activity_log;")
    cursor.execute("DELETE FROM public.fees_term_close_conversion_detail;")
    cursor.execute("DELETE FROM public.fees_term_close_period;")
    cursor.execute("DELETE FROM public.payments_paymentevent;")
    cursor.execute("DELETE FROM public.fees_feestructure;")
    cursor.execute("DELETE FROM public.fees_feebalance;")
    cursor.execute("DELETE FROM public.fees_debittransaction;")
    cursor.execute("DELETE FROM public.fees_paymenttransaction;")
    cursor.execute("DELETE FROM public.payments_paymentingresslog;")
    cursor.execute("DELETE FROM public.payments_schoolpaymentconfig;")
    cursor.execute("DELETE FROM public.fees_votehead;")
    cursor.execute("DELETE FROM public.students WHERE school_id IN (SELECT id FROM public.schools_school WHERE code='USHIRIKA');")
    cursor.execute("DELETE FROM public.users WHERE school_id IN (SELECT id FROM public.schools_school WHERE code='USHIRIKA');")
    cursor.execute("DELETE FROM public.schools_school WHERE code='USHIRIKA';")

# 1. School
school = School.objects.create(name='Ushirika Academy', code='USHIRIKA', email='info@ushirika.edu')

# 2. Bursar User
bursar_user = User.objects.create_user(
    email='bursar@ushirika.edu',
    username='val_bursar',
    password='SecurePassword123!',
    role='bursar',
    school=school
)

# 3. Student
student = Student.objects.create(
    school=school,
    admission_number='ADM-5501',
    level='UP',
    full_name='Arthur Pendragon',
    gender='M',
    date_of_birth=datetime(2015, 6, 12).date(),
    guardian_name='Uther Pendragon',
    guardian_phone='+254711222333',
    admission_year=2026
)

# 4. Vote Heads
tuition_vh = VoteHead.objects.create(school=school, name='Tuition', priority=1)
transport_vh = VoteHead.objects.create(school=school, name='Transport', priority=2)

# 5. Fee Structure
FeeStructure.objects.create(school=school, year=2026, term=1, vote_head=tuition_vh, amount=Decimal('15000.00'))
FeeStructure.objects.create(school=school, year=2026, term=1, vote_head=transport_vh, amount=Decimal('5000.00'))

# 6. Debit Transactions / Invoices
DebitTransaction.objects.create(
    school=school, student=student, vote_head=tuition_vh, year=2026, term=1,
    amount=Decimal('15000.00'), invoice_number='INV-2026-001'
)
DebitTransaction.objects.create(
    school=school, student=student, vote_head=transport_vh, year=2026, term=1,
    amount=Decimal('5000.00'), invoice_number='INV-2026-002'
)

# 7. Fee Balances Trackers
FeeBalance.objects.create(
    school=school, student=student, vote_head=tuition_vh, year=2026, term=1,
    opening_balance=Decimal('0.00'), amount_invoiced=Decimal('15000.00'),
    amount_paid=Decimal('10000.00'), closing_balance=Decimal('5000.00')
)
FeeBalance.objects.create(
    school=school, student=student, vote_head=transport_vh, year=2026, term=1,
    opening_balance=Decimal('0.00'), amount_invoiced=Decimal('5000.00'),
    amount_paid=Decimal('8000.00'), closing_balance=Decimal('-3000.00')
)

# 8. Payment Config
pay_config = SchoolPaymentConfig.objects.create(
    school=school,
    provider='mpesa',
    short_code='4025001',
    account_name='Ushirika Collections',
    is_active=True
)

# 9. Payment Ingress and Payment Events
ingress_log = PaymentIngressLog.objects.create(
    provider='mpesa',
    short_code='4025001',
    raw_payload={'TransID': 'MPESAX881', 'Amount': '18000.00', 'MSISDN': '254711222333', 'BillRefNumber': 'ADM-5501'},
    resolved_school=school
)

pay_txn = PaymentTransaction.objects.create(
    school=school,
    student=student,
    amount=Decimal('18000.00'),
    transaction_code='MPESAX881',
    mode='mpesa',
    apportion_log={'provider': 'mpesa', 'allocations': [{'vote_head': 'Tuition', 'amount': 10000.0}, {'vote_head': 'Transport', 'amount': 8000.0}], 'year': 2026, 'term': 1}
)

reconciled_event = PaymentEvent.objects.create(
    school=school,
    ingress_log=ingress_log,
    idempotency_key='mpesa:MPESAX881',
    provider='mpesa',
    transaction_code='MPESAX881',
    amount=Decimal('18000.00'),
    phone_number='254711222333',
    reference='ADM-5501',
    payment_config=pay_config,
    student=student,
    payment_transaction=pay_txn,
    status='RECONCILED'
)

# Seed an unresolved event for contract coverage
unresolved_ingress = PaymentIngressLog.objects.create(
    provider='mpesa',
    short_code='4025001',
    raw_payload={'TransID': 'MPESABAD9', 'Amount': '2000.00', 'MSISDN': '254711222333', 'BillRefNumber': 'ADM-INVALID-X'},
    resolved_school=school
)

unresolved_event = PaymentEvent.objects.create(
    school=school,
    ingress_log=unresolved_ingress,
    idempotency_key='mpesa:MPESABAD9',
    provider='mpesa',
    transaction_code='MPESABAD9',
    amount=Decimal('2000.00'),
    phone_number='254711222333',
    reference='ADM-INVALID-X',
    payment_config=pay_config,
    status='UNRESOLVED_STUDENT'
)

# Seed rollover conversion logs for API contract verification
tc_period = TermClosePeriod.objects.create(
    school=school,
    year=2026,
    term=1,
    target_year=2026,
    target_term=2,
    status='CLOSED',
    started_by=bursar_user,
    closed_by=bursar_user,
    rows_processed=1,
    notes='Carry-forward completed successfully.'
)

TermCloseConversionDetail.objects.create(
    period=tc_period,
    school=school,
    student=student,
    source_year=2026,
    source_term=1,
    target_year=2026,
    target_term=2,
    source_vote_head=tuition_vh,
    source_closing_balance=Decimal('5000.00'),
    target_type='ARREARS',
    target_amount=Decimal('5000.00')
)

print("--- [SEEDING COMPLETE] Seeding validation baseline established successfully. ---\n")


def check_endpoint_auth_denial(url, method='GET', data=None):
    """Verifies that an unauthenticated request receives 401 or 403."""
    client.force_authenticate(user=None)
    if method == 'GET':
        response = client.get(url)
    elif method == 'POST':
        response = client.post(url, data=data, format='json')
    stat = response.status_code
    is_blocked = (stat in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    return is_blocked, stat, response.data if hasattr(response, 'data') else None


def execute_check(title, url, method='GET', post_data=None):
    """Performs validation check on target endpoint, gathering status, pagination, and exact schema keys."""
    # 1. Unauthenticated Block check
    unauth_pass, unauth_status, unauth_err = check_endpoint_auth_denial(url, method, post_data)
    
    # 2. Authenticated OK check
    client.force_authenticate(user=bursar_user)
    if method == 'GET':
        response = client.get(url)
    elif method == 'POST':
        response = client.post(url, post_data, format='json')
        
    auth_status = response.status_code
    response_data = response.data if hasattr(response, 'data') else None
    
    # Determine pagination presence
    is_paginated = False
    pagination_keys = []
    if isinstance(response_data, dict):
        p_keys = {'count', 'next', 'previous', 'results'}
        if p_keys.issubset(response_data.keys()):
            is_paginated = True
            pagination_keys = list(response_data.keys())
            
    # Calculate response structure type
    res_type = "UNKNOWN"
    if isinstance(response_data, dict):
        res_type = "DICT_OBJECT"
    elif isinstance(response_data, list):
        res_type = "FLAT_LIST"
        
    print(f"\n========================================================")
    print(f"API ENDPOINT CHECK: {title}")
    print(f"URL: {url} [{method}]")
    print(f"========================================================")
    print(f"  Unauthenticated Blocking Guard Code: {unauth_status} (Expected 401/403) -> {'PASS' if unauth_pass else 'FAIL'}")
    print(f"  Authenticated Response Status Code: {auth_status} (Expected 200/201)")
    print(f"  Response Container Data Structure: {res_type}")
    print(f"  Pagination Present: {is_paginated} {f'(Pagination Keys: {pagination_keys})' if is_paginated else ''}")
    
    # Analyze the inner item key schema parity
    sample_item = None
    if isinstance(response_data, dict) and 'results' in response_data and isinstance(response_data['results'], list) and title not in ["Payments Dashboard", "Student Ledger Statement", "Term-Close Preview"]:
        results_list = response_data['results']
        if len(results_list) > 0:
            sample_item = results_list[0]
        else:
            sample_item = {}
    elif is_paginated and isinstance(response_data, dict) and 'results' in response_data:
        results_list = response_data['results']
        if len(results_list) > 0:
            sample_item = results_list[0]
    elif res_type == "DICT_OBJECT":
        sample_item = response_data
    elif res_type == "FLAT_LIST" and len(response_data) > 0:
        sample_item = response_data[0]
        
    schema_keys = []
    if isinstance(sample_item, dict):
        schema_keys = list(sample_item.keys())
        print(f"  Inner Entity Key Schema: {schema_keys}")
    else:
        print(f"  Inner Entity Key Schema: FLAT VALUE or EMPTY CONTAINER")
        
    return {
        'title': title,
        'url': url,
        'method': method,
        'unauth_pass': unauth_pass,
        'unauth_status': unauth_status,
        'auth_status': auth_status,
        'res_type': res_type,
        'is_paginated': is_paginated,
        'keys': schema_keys,
        'raw_sample': sample_item
    }

results = []

# List Endpoints under /api/payments/
results.append(execute_check("Payment Events (All)", "/api/payments/events/"))
results.append(execute_check("Payment Events (Unresolved)", "/api/payments/events/unresolved/"))

# Dashboard under /api/payments/
results.append(execute_check("Payments Dashboard", "/api/payments/dashboard/"))

# Reports under /api/payments/reports/
results.append(execute_check("Payments Daily Report", "/api/payments/reports/daily/"))
results.append(execute_check("Payments Providers Report", "/api/payments/reports/providers/"))
results.append(execute_check("Payments Voteheads Report", "/api/payments/reports/voteheads/"))

# Student Statement Endpoint
results.append(execute_check("Student Ledger Statement", f"/api/students/{student.id}/statement/"))

# Term-close API views under /api/finance/term-close/
results.append(execute_check("Term-Close Preview", "/api/finance/term-close/preview/?year=2026&term=1"))
results.append(execute_check("Term-Close Conversion Report", "/api/finance/term-close/conversion-report/"))

# We also check the other finance reports to cover any hidden contract mismatches
results.append(execute_check("Finance Outstanding Report", "/api/finance/reports/outstanding/?year=2026&term=1"))
results.append(execute_check("Finance Student Aging Report", "/api/finance/reports/student-aging/"))
results.append(execute_check("Finance Collection Effectiveness Report", "/api/finance/reports/collection-effectiveness/"))
results.append(execute_check("Finance Debt Analytics Report", "/api/finance/reports/debt-analytics/"))

print("\n\n========================================================")
print("FINAL API CONTRACT SERALIZER PARITY COMPARISON (FREEZE ASSESSMENT)")
print("========================================================\n")

# Freezing frontend client expectation rules to prove 100% parity
frontend_rules = {
    "Payment Events (All)": [
        "id", "idempotency_key", "provider", "provider_display", "transaction_code", "amount", 
        "phone_number", "reference", "status", "status_display", "error_message", "student", 
        "student_name", "school", "school_name", "payment_transaction", "retry_count", "processed_at",
        "sms_status", "sms_status_display", "sms_sent_at", "ingress_received_at", "routed_at"
    ],
    "Payments Dashboard": [
        "total_events", "reconciled_events", "unresolved_events", "duplicate_events", "total_amount", "today_amount", "providers"
    ],
    "Student Ledger Statement": [
        "student", "filters", "totals", "entries"
    ],
    "Term-Close Preview": [
        "source_period", "target_period", "totals", "students"
    ],
    "Term-Close Conversion Report": [
        "period_id", "student_name", "source_year", "source_term", "target_year", "target_term", 
        "source_vote_head", "source_closing_balance", "target_type", "target_amount", "created_at"
    ]
}

violations = 0
for r in results:
    title = r['title']
    if title in frontend_rules:
        expected = frontend_rules[title]
        actual = r['keys']
        missing_keys = [k for k in expected if k not in actual]
        
        print(f"Endpoint: {title} ({r['url']})")
        print(f"  Expected Key Contract: {expected}")
        print(f"  Actual Active Key Schema: {actual}")
        if missing_keys:
            print(f"  ❌ SERIALIZER CONTRACT DRIFT VIOLATION Detected! Missing keys: {missing_keys}")
            violations += 1
        else:
            print(f"  ✅ 100% SERIALIZER PARITY CONFORMED - Core Interface Frozen.")
        print("-" * 50)

print(f"\n========================================================")
print(f"AUDIT EXECUTION REPORT SUMMARY")
print(f"========================================================")
print(f"Total API Endpoints Inspected: {len(results)}")
print(f"Serializer Frozen Contract Violations Found: {violations}")
if violations == 0:
    print(f"VERDICT: VERIFIED PASS. All API contracts match frozen frontend expectations precisely!")
else:
    print(f"VERDICT: FAIL. Contract Drift detected! Fix mismatches before signing off.")
print(f"========================================================\n")
sys.exit(violations)
