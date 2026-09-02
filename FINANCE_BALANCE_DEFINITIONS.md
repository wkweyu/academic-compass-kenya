# Finance Balance Definitions & Calculations Specification

This document serves as the single authoritative reference for all financial balances, ledger metrics, and balance calculations across the SkoolTrack Pro ERP system. All frontend views, backend APIs, services, and reports must adhere strictly to these business definitions and formulas.

---

## 1. Overall Student Outstanding Balance (formerly "Net Ledger Balance")

### Business Purpose & Meaning
Represents a student's total, cumulative financial position across their entire lifecycle at the institution across all academic years and terms. It reflects the total net amount currently owed by the student (or credit held if negative).

### Calculation Formula
```
Overall Student Outstanding = Opening Balance
                            + Previous Year Arrears
                            + Previous Term Arrears
                            + Sum(All Invoices & Debit Notes)
                            - Sum(All Payments & Receipts)
                            - Sum(Credit Notes)
                            - Sum(Waivers & Scholarships)
                            + Sum(Refunds Issued)
```
Alternatively calculated directly from the student ledger debit/credit totals:
```
Overall Student Outstanding = Cumulative Debit Total - Cumulative Credit Total
```

### Included & Excluded Transactions
- **Included:** All active debit transactions, additional fee debits, payment receipts (non-reversed), credit notes, waivers, refunds, and opening/brought-forward balances.
- **Excluded:** Cancelled or reversed receipts, draft fee structures not yet posted to student accounts.

### UI Display Locations
- **Bursar Cash Terminal:** Main header summary card ("Overall Student Outstanding").
- **Student Profile (Fees Tab):** Overview metric card.
- **Student Ledger Table:** Balance column / Ledger summary.
- **Student Statement:** Final running balance at the bottom of the statement.
- **Collections & Debt Analytics Reports:** Total outstanding debt per student.

### Exposed API Fields
- `overall_balance`
- `running_balance`
- `totals.balance` (in `StudentStatementAPIView`)

---

## 2. Current Term Outstanding (formerly "Term Net Due")

### Business Purpose & Meaning
Represents the outstanding net fee obligation for a student **strictly within the selected Academic Year and Term**. It isolates the current period's financial obligation from historical debt or advance payments, allowing cashiers and parents to see exact term-specific obligations.

### Calculation Formula
```
Current Term Outstanding = Current Term Charges (Invoiced Fees)
                         + Current Term Additional Debits
                         - Current Term Payments Received
                         - Current Term Credit Notes
                         - Current Term Waivers & Scholarships
                         + Current Term Refunds
```

*Note:* Must **never** include historical previous-term arrears unless explicitly billed as a distinct current-term line item.

### Included & Excluded Transactions
- **Included:** Invoices, debit notes, receipts, credit notes, and waivers timestamped or tagged with the active `(year, term)`.
- **Excluded:** B/F opening balances, transactions belonging to prior or future terms/years.

### UI Display Locations
- **Bursar Cash Terminal:** Current Term summary card ("Current Term Outstanding").
- **Fee Collection Dialogs:** Term balance breakdown.
- **Term Fee Structure Summary:** Outstanding per term.

### Exposed API Fields
- `current_term_balance`
- `current_term_net_due`

---

## 3. Opening Balance / Brought-Forward (B/F) Balance

### Business Purpose & Meaning
The net balance carried forward into a new academic term or year from the closing balance of the immediately preceding term or year.

### Calculation Formula
```
Opening Balance (Term N, Year Y) = Closing Balance (Term N-1, Year Y)
```
- If positive: Represents **Arrears Brought Forward**.
- If negative: Represents **Prepayment / Advance Credit Brought Forward**.

### UI Display Locations
- **Student Statement:** Initial Brought-Forward line item (`BROUGHT_FORWARD_ARREARS` or `BROUGHT_FORWARD_PREPAYMENT`).
- **Term Close & Rollover Management Panel.**

### Exposed API Fields
- `opening_balance`
- `previous_term_arrears`

---

## 4. Previous Term Arrears & Previous Year Arrears

### Business Purpose & Meaning
Specific breakdowns of historical unpaid balances carried forward into the active term.
- **Previous Term Arrears:** Unpaid balances originating from earlier terms within the same academic year.
- **Previous Year Arrears:** Unpaid balances originating from prior academic years.

### Calculation Formula
```
Previous Term Arrears = Sum(Closing Balances of prior terms in current year where Closing Balance > 0)
Previous Year Arrears = Sum(Closing Balances of all terms in prior years where Closing Balance > 0)
```

### UI Display Locations
- **Debt Analytics Report & Aging Analysis.**
- **Student Financial Profile Detail.**

### Exposed API Fields
- `previous_term_arrears`
- `previous_year_arrears`

---

## 5. Running Balance

### Business Purpose & Meaning
The line-by-line cumulative net balance on a student statement or ledger history. Computed chronologically as transactions occur.

### Calculation Formula
```
Running Balance_i = Running Balance_(i-1) + Debit_i - Credit_i
```

### UI Display Locations
- **Student Statement Table:** "Balance" column on each transaction row.
- **General Ledger / Audit Trail.**

### Exposed API Fields
- `entries[].balance`
- `running_balance`

---

## 6. Credit Balance / Prepayment

### Business Purpose & Meaning
Occurs when a student (or guardian) has paid more money than total charges invoiced, resulting in a negative net outstanding balance (the school owes services or a refund to the student).

### Calculation Formula
```
Credit Balance = Math.abs(Overall Student Outstanding)   [where Overall Student Outstanding < 0]
```

### UI Display Locations
- **Bursar Cash Terminal:** Highlighted in green badge when balance < 0.
- **Overpayment & Advance Credit Reports.**

### Exposed API Fields
- `credit_balance`
- `prepayment`

---

## 7. Votehead Balance

### Business Purpose & Meaning
The outstanding amount owed for a specific charge category (e.g., Tuition, Transport, Uniform, Boarding) for a specific student or across a class.

### Calculation Formula
```
Votehead Balance = Votehead Invoiced Amount - Votehead Allocated Payments
```

### UI Display Locations
- **Fee Balance Register per Votehead.**
- **Receipt Allocation Breakdown.**

### Exposed API Fields
- `vote_head_balances[]`
- `closing_balance` (in `FeeBalanceRecord`)

---

## 8. Summary Matrix of Balance Definitions

| Balance Name | Period Scope | Formula Summary | UI Label |
| :--- | :--- | :--- | :--- |
| **Overall Student Outstanding** | Lifetime | `Total Debits - Total Credits` | `Overall Student Outstanding` |
| **Current Term Outstanding** | Term-Specific | `Term Debits - Term Credits` | `Current Term Outstanding` |
| **Opening Balance** | Prior Period | `Prior Term Closing Balance` | `Arrears B/F` / `Prepayment B/F` |
| **Running Balance** | Transaction Level | `Previous Balance + Debit - Credit` | `Balance` (on ledger rows) |
| **Votehead Balance** | Category & Term | `Votehead Invoiced - Votehead Paid` | `Votehead Outstanding` |

---

## 9. Canonical API & Service Payload Definition

All finance components and endpoints must consume the canonical finance balance structure returned by `calculate_student_balance()`:

```json
{
  "student_id": 580,
  "overall_balance": 8200.00,
  "opening_balance": 400.00,
  "previous_term_arrears": 400.00,
  "current_term_balance": 7800.00,
  "current_term_charges": 22800.00,
  "current_term_payments": 15000.00,
  "current_term_debits": 22800.00,
  "current_term_credits": 15000.00,
  "waivers": 0.00,
  "scholarships": 0.00,
  "refunds": 0.00,
  "running_balance": 8200.00
}
```

This specification ensures complete financial consistency, auditability, and clarity across all SkoolTrack Pro ERP user interfaces.
