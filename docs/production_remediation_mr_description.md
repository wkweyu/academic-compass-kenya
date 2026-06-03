# Merge Request Description

## What this changes

This remediation updates the finance reconciliation path so payment allocation uses actual outstanding `FeeBalance` values for the selected year and term, and adds regression coverage for repairing incomplete closed term-close periods through the existing `force=true` rerun path.

## Why this is needed

The production-readiness audit identified two live finance blockers:

1. Payment allocation was using a placeholder balance lookup, which allowed allocation into voteheads with zero or negative balances.
2. A closed term-close period existed with incomplete conversion detail and missing brought-forward balances.

## Included changes

- `apps/fees/services/__init__.py`
  - Replace placeholder votehead balance lookup with a real `FeeBalance` aggregate.
  - Make `apportion_payment()` year/term-aware.
  - Prevent allocation into zero/negative-balance voteheads.
- `apps/payments/services/reconciliation.py`
  - Pass the selected `year` and `term` into apportionment.
- `apps/payments/tests.py`
  - Add regression coverage for skipping negative-balance voteheads.
- `apps/fees/tests.py`
  - Add regression coverage proving `force=true` rerun repairs an incomplete closed period.

## Validation

- `python manage.py test apps.payments.tests.FinanceIntegrityandSandboxTests --verbosity 2`
  - `7/7` passed
- `python manage.py test apps.fees.tests.TermCloseFinanceAPITests --verbosity 2`
  - `16/16` passed

## Local post-fix evidence

- Ledger allocation no longer allocates into the negative-balance `Transport` votehead for the sampled student.
- The previously incomplete local closed term-close period now has:
  - complete conversion-detail rows,
  - target `Arrears` and `Prepayment` balances,
  - populated `closed_at`.

## Remaining release condition

Production is still blocked until the same repair path is executed in a production-connected environment and the production readiness gate is rerun with fresh production evidence.

Production execution runbook: `docs/production_term_close_repair_runbook.md`