## Payroll Module Enhancement Plan

### Problems Identified

1. **Staff without salary structures go unnoticed** -- no visibility into who's missing from payroll
2. **Salary structure changes don't propagate** to existing draft payroll runs
3. **Missing Kenyan statutory deductions**: NITA levy (KES 50/employee) and Affordable Housing Levy (1.5% of gross)
4. **Bank advice works** but employees belong to different banks hence per-bank Excel export formatting
5. **Payslips not auto-generated** -- they exist but require manual navigation
6. **Accounting integration posts all statutory to one account** (2100) instead of separate liability accounts

7.allow for maintenance of the payment slabs and not hard coding

### Implementation Plan

#### 1. Database Migration

Add `housing_levy` and `nita_levy` columns to both `payroll_salary_structures` and `payroll_entries` tables. Add separate chart of accounts entries for Housing Levy (2400) and NITA (2500) payable.

```sql
ALTER TABLE payroll_salary_structures 
  ADD COLUMN housing_levy numeric DEFAULT 0,
  ADD COLUMN nita_levy numeric DEFAULT 0;

ALTER TABLE payroll_entries
  ADD COLUMN housing_levy numeric DEFAULT 0,
  ADD COLUMN nita_levy numeric DEFAULT 0;
```

#### 2. Statutory Calculation Updates (`payrollService.ts`)

- Add `calculateHousingLevy(gross)`: 1.5% of gross salary
- Add `calculateNITA()`: flat KES 50 per employee per month
- Update `calculateStatutoryDeductions()` to include both new levies
- Update `createPayrollRun()` to include housing_levy and nita_levy in entries
- Add **"Staff Without Salary Structures"** detection: compare active teachers against those with active salary structures
- Add **"Refresh Draft Run"** function: re-generates entries for a draft payroll run from current salary structures (deletes old entries, re-inserts from latest structures)

#### 3. Salary Structure Coverage Alert (`PayrollPage.tsx`)

- Add a warning banner in Salary Setup tab showing count of active staff without salary structures
- List the uncovered staff names with a quick-add button
- On payroll run creation, show a confirmation dialog if any staff are missing structures

#### 4. Draft Run Refresh

- Add "Refresh from Structures" button on draft payroll runs
- Calls a new `refreshPayrollRun(runId)` method that deletes existing entries and re-generates from current active salary structures
- Only available for `draft` status runs

#### 5. Enhanced Bank Advice (`BankAdviceTab.tsx`)

- Already groups by bank_name -- this works for SACCOs too since SACCO names go in the bank_name field
- Add bank-specific Excel format export (KCB, Equity, Co-op formats) with configurable column ordering
- Add "Print All" button for batch printing

#### 6. Auto-Generate Payslips on Run Creation

- After creating a payroll run, auto-navigate to the payslips tab with the new run selected
- Add "Print All Payslips" bulk action that opens a print window with all payslips paginated

#### 7. Accounting Integration Fix (`postPayrollToAccounting`)

- Create separate journal entry lines for each statutory deduction:
  - PAYE Payable (2100)
  - NHIF Payable (2200) 
  - NSSF Payable (2300)
  - Housing Levy Payable (2400) -- new account
  - NITA Payable (2500) -- new account
- Seed these new accounts in `accountingService.seedDefaultAccounts()`

#### 8. Reports Enhancement (`PayrollReportsTab.tsx`)

- Add Housing Levy and NITA columns to statutory returns report
- Add employer contribution summary (NSSF employer portion, NITA)
- Add P9 tax report format for KRA filing
- Update CSV exports to include all statutory deductions

#### 9. Payslip Update (`PayslipPrint.tsx`)

- Add Housing Levy and NITA rows in the deductions section

### Files to Create/Edit


| File                                           | Action                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `supabase/migrations/..._payroll_levies.sql`   | Add housing_levy, nita_levy columns + new chart of accounts                            |
| `src/services/payrollService.ts`               | Add levy calculations, staff coverage check, draft refresh, updated accounting posting |
| `src/services/accountingService.ts`            | Add Housing Levy & NITA accounts to seed defaults                                      |
| `src/pages/PayrollPage.tsx`                    | Coverage warning, refresh button, auto-navigate to payslips, bulk print                |
| `src/components/payroll/PayslipPrint.tsx`      | Add Housing Levy & NITA deduction rows                                                 |
| `src/components/payroll/PayrollReportsTab.tsx` | Add levy columns, P9 format                                                            |
| `src/components/payroll/BankAdviceTab.tsx`     | Bank-format exports, print all                                                         |
