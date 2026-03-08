

# Accounting Module - Complete System Enhancement Plan

## Current State

The accounting module currently has:
- **Chart of Accounts** with parent_id support (unused in UI), flat list display
- **Journal Entries** with draft/posted/voided status workflow
- **Trial Balance** computed from posted journal entry lines
- **audit_logs** table already exists for general audit logging
- No fiscal year management, no fund accounting, no financial statements, no bank reconciliation, no IPSAS support

The `schools_school` table has a `type` field that can distinguish public vs private schools.

---

## What Needs to Be Built

This is a large undertaking. The plan is organized into **5 phases** to be implemented systematically.

---

### Phase 1: Database Schema (New Tables + Alterations)

**New tables to create via migration:**

1. **`fiscal_years`** - Configurable fiscal year periods per school
   - `id`, `school_id`, `name` (e.g. "FY 2025/2026"), `start_date`, `end_date`, `is_locked`, `is_current`, `created_at`
   - Unique constraint on (school_id, name)

2. **`accounting_funds`** - Fund accounting for IPSAS
   - `id`, `school_id`, `fund_code`, `fund_name`, `fund_type` (tuition/government_grant/infrastructure/feeding/other), `description`, `is_restricted`, `is_active`, `created_at`

3. **`bank_accounts`** - For bank reconciliation
   - `id`, `school_id`, `account_id` (FK to chart_of_accounts), `bank_name`, `account_number`, `branch`, `is_active`, `created_at`

4. **`bank_reconciliation_entries`** - Bank reconciliation records
   - `id`, `school_id`, `bank_account_id`, `reconciliation_date`, `statement_balance`, `ledger_balance`, `adjusted_balance`, `status` (draft/completed), `reconciled_by`, `created_at`

5. **`bank_reconciliation_items`** - Individual reconciliation line items
   - `id`, `reconciliation_id`, `journal_entry_id` (nullable), `description`, `amount`, `item_type` (outstanding_check/deposit_in_transit/bank_charge/interest/other), `is_reconciled`, `created_at`

**Alter existing tables:**
- **`chart_of_accounts`**: Add `fund_id` (nullable FK to accounting_funds), `is_header` (boolean, for grouping accounts)
- **`journal_entries`**: Add `fiscal_year_id` (FK), `fund_id` (nullable FK), `reversal_of_id` (nullable self-FK for reversal entries instead of deletion), `is_reversal` boolean
- **`journal_entry_lines`**: Add `fund_id` (nullable FK)

**RLS policies** on all new tables scoped by `school_id` using `get_user_school_id()`.

---

### Phase 2: Audit Controls & Reversal System

**Key principle: Transactions cannot be deleted, only reversed.**

- Remove the `deleteAccount` capability from the service (soft-deactivate only)
- Remove the void/delete actions on posted entries; replace with **Reversal Entry** creation
- `voidJournalEntry` becomes creating a mirror reversal journal entry (debit↔credit swapped) with `is_reversal = true` and `reversal_of_id` pointing to original
- **Fiscal year locking**: Once a fiscal year is locked, no new journal entries can be posted to dates within that period
- All accounting mutations log to `audit_logs` via `log_audit_event()`
- Auto-generate reference numbers: `JE-YYYY-NNNNN` format via a DB function

---

### Phase 3: Enhanced Chart of Accounts & General Ledger

**Sub-accounts / hierarchy:**
- UI for creating sub-accounts (set `parent_id`) with tree-view display
- Header accounts vs posting accounts (`is_header`)
- Account code auto-suggestion based on parent

**General Ledger (Ledger Statement drill-down):**
- New tab showing per-account transaction history
- Filter by date range, fiscal year, fund
- Running balance calculation
- Click any account in Chart of Accounts or Trial Balance to drill down

---

### Phase 4: Financial Statements & Reports

All reports filter by fiscal year and optionally by fund.

1. **Trial Balance** (exists, enhance with fiscal year filter + fund filter)

2. **General Ledger Report** - All accounts with their transactions

3. **Income & Expenditure Statement**
   - Income accounts (type=income) minus Expense accounts (type=expense)
   - Computed from posted journal entry lines within fiscal year

4. **Statement of Financial Position (Balance Sheet)**
   - Assets, Liabilities, Equity sections
   - Computed from cumulative posted balances

5. **Cash Flow Statement**
   - Operating, Investing, Financing activities
   - Derived from cash/bank account movements

6. **Bank Reconciliation**
   - Select bank account, enter statement balance
   - Mark outstanding checks, deposits in transit
   - Auto-calculate adjusted balance

7. **Transaction Audit Log**
   - Filtered view of `audit_logs` for accounting module
   - Shows who did what, when, with old/new values

**Print-ready formatting** for all reports with school letterhead.

---

### Phase 5: IPSAS Fund Accounting (Government Schools)

- **Fund management UI**: Create/manage funds (Tuition, Government Grant, Infrastructure, Feeding Program, etc.)
- **Fund tagging**: Journal entries and lines can be tagged to a specific fund
- **Fund-based reports**: All financial statements can be generated per-fund or consolidated
- **Government subsidy handling**: 
  - Government grants recorded as income in the Government Grant Fund
  - Fee subsidies create a journal entry: DR Government Grant Receivable, CR Tuition Fees Income
  - When subsidy is received: DR Bank, CR Government Grant Receivable
- **Restricted vs unrestricted funds**: Restricted funds can only be spent on designated purposes (enforced via fund tagging)
- Conditional UI: IPSAS features only shown when school `type` is 'public' or explicitly enabled in settings

---

## Technical Architecture

### Service Layer (`accountingService.ts`)
Extend with new methods:
- `getFiscalYears()`, `createFiscalYear()`, `lockFiscalYear()`
- `getFunds()`, `createFund()`, `updateFund()`
- `getLedgerStatement(accountId, filters)`
- `getIncomeExpenditure(fiscalYearId, fundId?)`
- `getFinancialPosition(fiscalYearId, fundId?)`
- `getCashFlowStatement(fiscalYearId)`
- `getBankReconciliation(bankAccountId)`
- `reverseJournalEntry(id)` (replaces void)
- `generateReferenceNumber()`
- `getAuditLog(filters)`

### UI Components (new files)
- `src/components/accounting/FiscalYearManager.tsx`
- `src/components/accounting/LedgerStatement.tsx`
- `src/components/accounting/IncomeExpenditure.tsx`
- `src/components/accounting/FinancialPosition.tsx`
- `src/components/accounting/CashFlowStatement.tsx`
- `src/components/accounting/BankReconciliation.tsx`
- `src/components/accounting/AuditTrail.tsx`
- `src/components/accounting/FundManager.tsx`
- `src/components/accounting/AccountTreeView.tsx`
- `src/components/accounting/ChartOfAccountsTab.tsx`
- `src/components/accounting/JournalEntriesTab.tsx`

### Page Restructure (`AccountingPage.tsx`)
Convert from monolithic page to tabbed module:
- Chart of Accounts | General Ledger | Journal Entries | Reports | Bank Reconciliation | Fund Accounting | Audit Trail
- Reports sub-tabs: Trial Balance | Income & Expenditure | Financial Position | Cash Flow

---

## Implementation Priority

Given the scope, implementation will proceed in this order:
1. Database migration (all tables at once)
2. Fiscal year management + account hierarchy
3. Reversal system + audit controls
4. General Ledger drill-down
5. Financial statements (Income & Expenditure, Balance Sheet, Cash Flow)
6. Bank Reconciliation
7. IPSAS Fund Accounting
8. Print-ready report formatting

