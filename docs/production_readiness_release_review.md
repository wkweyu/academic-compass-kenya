# Production Readiness Release Review

- generated_at_utc: 2026-06-03T05:45:35.8494307Z
- source_of_truth: `docs/finance_audit_execution_log.md`
- current_decision: `BLOCKED`

## Incident Summary

Production release is blocked by two live finance failures discovered during the evidence-only remediation run. The first is a ledger allocation defect: live payment apportionment allocates against a hardcoded expected balance rather than the student's actual outstanding balances. The second is a term-close conservation defect: the latest closed period in the live database contains only one conversion-detail row and no target brought-forward balances, leaving carry-forward state unreconstructable.

No frontend/backend route gaps were found. Schema drift remains a separate blocker because active finance tables used by live routes are missing from the production schema artifact, but the two issues above are independently sufficient to stop deployment.

## Leadership Summary

- Severity: High
- Release status: Blocked
- Customer risk: Financial misposting and irreconcilable term-close carry-forward state
- Scope: Finance reconciliation and term-close rollover
- Evidence basis: Live database inspection, focused ORM/SQL extraction, and focused finance test runs on a clean test database

## Developer Action Checklist

### Live Blocker 1: Ledger Allocation Realism

- Inspect `apps/fees/services/__init__.py` and remove the hardcoded placeholder path from `get_student_balance_for_votehead()`.
- Re-implement votehead allocation against actual outstanding balances only.
- Add a focused regression test proving a payment cannot allocate more than the positive closing balance of a votehead.
- Add a focused regression test proving a votehead with zero or negative closing balance receives no allocation.
- Re-run the focused payment integrity tests and capture fresh SQL/ORM evidence showing expected balances and actual allocations match.

### Live Blocker 2: Term-Close Conservation

- Inspect the rollover path in `apps/fees/finance_views.py` and trace why the latest closed live period persisted only one conversion-detail row.
- Verify whether target `Arrears` and `Prepayment` `FeeBalance` rows were skipped, rolled back, or never written.
- Add or strengthen regression coverage so a mixed positive/negative source balance case must persist two conversion-detail rows and the corresponding target brought-forward balances.
- Repair the affected closed-period data through an approved remediation path, then rerun the term-close reconciliation queries.
- Capture fresh evidence showing source balances, conversion-detail rows, and target brought-forward balances reconcile exactly per student.

## Key Evidence

### Evidence A: Live Allocation Mismatch

```text
allocation_appendix
{'school_id': 8, 'student_id': 6, 'balances': [('Tuition', Decimal('5000.00')), ('Transport', Decimal('-3000.00'))], 'actual_allocations': [{'vote_head': 'Tuition', 'amount': 10000}, {'vote_head': 'Transport', 'amount': Decimal('2000.00')}]}
```

Interpretation:

- The only positive live closing balance is `Tuition = 5000.00`.
- The live apportionment output still allocates `10000` to Tuition and `2000.00` to Transport.
- This is direct evidence that allocation is not constrained by actual outstanding balances.

### Evidence B: Live Term-Close Mismatch

```text
term_close_appendix
{'period_id': 2, 'school_id': 8, 'source_period': (2026, 1), 'target_period': (2026, 2), 'detail_rows': [(6, 'Tuition', Decimal('5000.00'), 'ARREARS', Decimal('5000.00'))], 'target_rows': []}
```

Interpretation:

- The latest closed period contains only one conversion-detail row.
- No target brought-forward `Arrears` or `Prepayment` rows exist for the target term.
- This conflicts with the clean-test expectation for a mixed arrears/prepayment rollover case.

## Release Recommendation

Do not deploy until both live blockers are remediated and rerun evidence confirms:

1. Allocation matches actual positive outstanding balances per votehead.
2. Closed term-close periods produce complete conversion-detail rows and corresponding brought-forward balances.
3. The final deployment gate in `docs/finance_audit_execution_log.md` is rerun and updated from `BLOCKED` only after fresh evidence passes.