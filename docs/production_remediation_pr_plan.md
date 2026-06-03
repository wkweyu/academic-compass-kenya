# Production Remediation PR Plan

- generated_at_utc: 2026-06-03T05:57:25.7474308Z
- scope: Ledger allocation remediation, term-close repair path validation, and production rollout plan
- status: Ready for PR preparation

## Objective

Ship the smallest remediation set that resolves the two verified finance blockers without changing unrelated finance workflows:

1. Ledger allocation must use actual outstanding balances for the selected period.
2. Existing corrupted closed term-close periods must be repairable through the supported rerun path.

## Code Fixes

### 1. Ledger Allocation

Files:

- `apps/fees/services/__init__.py`
- `apps/payments/services/reconciliation.py`
- `apps/payments/tests.py`

Changes:

- Replace the hardcoded `get_student_balance_for_votehead()` placeholder with a real `FeeBalance` aggregate query.
- Make `apportion_payment()` year/term-aware so it allocates against the same oldest outstanding period selected by reconciliation.
- Preserve full-allocation behavior by carrying any excess onto the highest-priority applicable votehead instead of allocating into zero/negative-balance voteheads.
- Add a regression test proving a negative-balance votehead receives no allocation.

Acceptance criteria:

- Focused payments integrity tests pass.
- Live/local post-fix allocation evidence shows no allocation into negative-balance voteheads.

### 2. Term-Close Repair Path Validation

Files:

- `apps/fees/tests.py`

Changes:

- Add a regression test proving `force=true` rerun repairs an incomplete closed period by recreating both conversion-detail rows and target brought-forward balances.

Acceptance criteria:

- Focused term-close test suite passes.
- Existing rerun path remains the approved repair mechanism for corrupted closed periods.

## Data Repair Plan

### Local Validation Already Performed

The affected local closed period was repaired by rerunning the existing endpoint with force enabled:

```text
POST /api/finance/term-close/rollover/
payload = { year: 2026, term: 1, force: true }
```

Observed local result:

- The previously incomplete period now has two conversion-detail rows.
- Target `Arrears` and `Prepayment` balances now exist.
- `closed_at` is populated.

### Production Data Repair Steps

1. Identify all closed periods with either:
   - missing `Prepayment`/`Arrears` target rows, or
   - mismatched conversion-detail row counts versus source balances.
2. For each affected period, rerun the existing rollover endpoint or equivalent authenticated service call with `force=true`.
3. Re-query the repaired period to verify:
   - both conversion-detail rows exist for mixed positive/negative balances,
   - target brought-forward balances exist,
   - `closed_at` is populated,
   - source totals reconcile to target totals.

## Post-Fix Validation

### Required Automated Checks

1. `python manage.py test apps.payments.tests.FinanceIntegrityandSandboxTests --verbosity 2`
2. `python manage.py test apps.fees.tests.TermCloseFinanceAPITests --verbosity 2`

### Required Data Checks

1. Re-run the compact allocation artifact against a student with a mixed positive/negative balance state.
2. Re-run the compact term-close appendix for the repaired closed period.
3. Re-run the finance readiness gate and update `docs/finance_audit_execution_log.md` with post-fix evidence.

### Required Release Checks

1. Confirm production migration state for the active finance tables still matches the shipped code.
2. Confirm no frontend/backend endpoint regressions.
3. Do not clear the final deployment gate until both live blockers and the schema drift blocker are re-evaluated with fresh production evidence.

## Post-Fix Evidence Snapshot

### Ledger Allocation

```text
post_fix_allocation_appendix
{'school_id': 8, 'student_id': 6, 'balances': [('Tuition', Decimal('5000.00')), ('Transport', Decimal('-3000.00')), ('Prepayment', Decimal('-3000.00')), ('Arrears', Decimal('5000.00'))], 'actual_allocations': [{'vote_head': 'Tuition', 'amount': Decimal('12000.00')}]}
```

### Term Close

```text
post_fix_term_close_appendix
{'period_id': 2, 'school_id': 8, 'source_period': (2026, 1), 'target_period': (2026, 2), 'detail_rows': [(6, 'Tuition', Decimal('5000.00'), 'ARREARS', Decimal('5000.00')), (6, 'Transport', Decimal('-3000.00'), 'PREPAYMENT', Decimal('3000.00'))], 'target_rows': [(6, 'Arrears', Decimal('5000.00'), Decimal('5000.00')), (6, 'Prepayment', Decimal('-3000.00'), Decimal('-3000.00'))], 'closed_at': '2026-06-03T05:53:26.104450+00:00'}
```

## Release Position

Local remediation is underway and the two previously live local blockers now have passing post-fix evidence. Production is still not automatically cleared for deployment because the production-side schema-drift gate and production data state still require fresh post-remediation verification.