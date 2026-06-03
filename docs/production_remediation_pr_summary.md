# Production Remediation PR Summary

- generated_at_utc: 2026-06-03T06:00:30Z
- source_plan: `docs/production_remediation_pr_plan.md`
- current_gate: `BLOCKED`

## Summary

This PR remediates the two verified local finance blockers identified in the production-readiness audit:

1. Ledger allocation now uses actual outstanding balances from `FeeBalance` for the selected year and term.
2. The supported `force=true` term-close rerun path is now regression-tested as the repair mechanism for incomplete closed periods.

## Changes Included

### Ledger Allocation Fix

- `apps/fees/services/__init__.py`
  - Replaced the placeholder balance lookup with a real `FeeBalance` aggregate.
  - Made `apportion_payment()` year/term-aware.
  - Prevented allocation into zero/negative-balance voteheads.
  - Preserved full-allocation behavior by carrying any excess to the highest-priority applicable votehead.

- `apps/payments/services/reconciliation.py`
  - Passed the selected `year` and `term` into `apportion_payment()` for both initial reconciliation and reprocessing paths.

- `apps/payments/tests.py`
  - Added a regression test proving a negative-balance votehead receives no allocation.

### Term-Close Repair Validation

- `apps/fees/tests.py`
  - Added a regression test proving `force=true` rerun repairs an incomplete closed period by restoring conversion-detail rows and brought-forward balances.

## Validation Performed

- `python manage.py test apps.payments.tests.FinanceIntegrityandSandboxTests --verbosity 2`
  - Result: `7/7` passed.
- `python manage.py test apps.fees.tests.TermCloseFinanceAPITests --verbosity 2`
  - Result: `16/16` passed.

## Post-Fix Local Evidence

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

## Production Follow-Up Required

This workspace is not connected to the production database. The active Django database target is:

```text
ENGINE=django.db.backends.postgresql
HOST=localhost
PORT=5432
NAME=skooltrack_pro
USER=postgres
```

Because of that, the following steps still need to be executed in a production-connected environment after deployment:

1. Run the same term-close repair operation against affected production periods using the supported `force=true` rerun path.
2. Re-run the production readiness gate with fresh production evidence.
3. Re-evaluate the schema drift blocker against actual production migration state.

Copy-paste execution runbook:

- `docs/production_term_close_repair_runbook.md`

## Release Status

Local remediation validation: PASS

Production deployment status: still BLOCKED pending production-side repair and post-fix verification.