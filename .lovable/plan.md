

## Uniform Items POS & Auto-Debit System

### Problem
There's no way to issue uniform items to students and automatically charge their fee accounts. The procurement module has inventory items but no student-facing POS flow that creates fee debits.

### Solution
Build a **Uniform POS** module that:
1. Maintains a catalog of uniform items with prices (reusing `procurement_item` where category = "Uniform")
2. Lets staff select a student, pick items + quantities, and "issue" them
3. Automatically creates a debit transaction against the **Uniform** votehead on the student's fee statement
4. Records the issue as a stock transaction for inventory tracking

### Database Changes

**New table: `uniform_issues`** — records each uniform sale/issue to a student:

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| school_id | bigint FK schools_school | |
| student_id | bigint FK students | |
| issued_by | bigint FK users (nullable) | Staff who issued |
| total_amount | decimal(12,2) | Sum of line items |
| term | int | Current term |
| year | int | Current year |
| remarks | text | Optional note |
| created_at | timestamptz | Default now() |

**New table: `uniform_issue_items`** — line items per issue:

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| issue_id | bigint FK uniform_issues | |
| item_id | bigint FK procurement_item | |
| item_name | varchar | Snapshot of name at time of issue |
| quantity | int | |
| unit_price | decimal(12,2) | Price at time of issue |
| total | decimal(12,2) | quantity × unit_price |

RLS: Both tables scoped to `school_id = get_user_school_id()` for authenticated users.

### Frontend Changes

**New component: `src/components/fees/UniformPOS.tsx`**
- POS-style interface with:
  - Student search/select (autocomplete by name or admission number)
  - Uniform items grid/list filtered from `procurement_item` where category is "Uniform" (or a configurable category)
  - Cart: add items with quantity, shows line totals and grand total
  - "Issue & Charge" button that:
    1. Inserts into `uniform_issues` + `uniform_issue_items`
    2. Creates a `fees_debittransaction` with the Uniform votehead
    3. Updates `fees_feebalance` for the Uniform votehead
    4. Updates `fees_student_ledger` (debit total + balance)
    5. Creates a `fees_ledger_entry` (DR: Accounts Receivable, CR: Uniform Sales)
    6. Optionally creates a `procurement_stocktransaction` (Issue type) per item for inventory deduction
  - Issue receipt/summary print

**Integration into Fees module:**
- Add a "Uniform POS" tab or a button in the Fees Management page that opens the POS dialog/page
- Reuse existing `feesService._updateStudentLedger()` and debit posting patterns from `AdditionalDebitsDialog`

### Service Layer

**New file or extend `feesService.ts`** with:
- `getUniformItems()` — fetch procurement items in "Uniform" category
- `issueUniform(studentId, items[], term, year)` — atomic operation that creates all the records above
- `getUniformIssueHistory(studentId?)` — fetch past issues with line items

### Flow Summary

```text
Staff selects student → Adds uniform items to cart → Clicks "Issue & Charge"
  ├─ uniform_issues + uniform_issue_items (POS record)
  ├─ fees_debittransaction (Uniform votehead debit)
  ├─ fees_feebalance (update invoiced amount)
  ├─ fees_student_ledger (update debit total + balance)
  ├─ fees_ledger_entry (double-entry: DR Receivable, CR Uniform Sales)
  └─ procurement_stocktransaction (inventory deduction, optional)
```

