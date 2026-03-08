

## Procurement Module Completion Plan

### Current State
The module has basic CRUD for suppliers, items, LPOs, and payment vouchers, but is missing critical procurement workflows:
- **No LPO line items** — LPOs are flat amounts with no item-by-item breakdown
- **No stock/inventory tab** in the UI (service exists but unused)
- **No petty cash UI** (table exists in DB)
- **No fees-in-kind UI** (table exists in DB)
- **No supplier ledger view** (purchases vs payments balance)
- **Incomplete LPO lifecycle** — only Pending→Approved, missing Delivered→Paid with goods receipt
- **No payment voucher approval workflow** — no approve/pay actions
- **No edit/delete** on most entities
- **No LPO or voucher printing**
- **No auto-generated document numbers**
- **No vote head linking** on vouchers (DB field exists, UI missing)
- **No purchase-to-stock flow** — delivering an LPO should create stock entries

### Database Changes

**New table: `procurement_lpo_items`** — Line items for each LPO
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| school_id | bigint FK | |
| lpo_id | bigint FK procurement_lpo | |
| item_id | bigint FK procurement_item | nullable (for ad-hoc items) |
| description | varchar(255) | Item description |
| quantity | int | |
| unit_price | numeric(12,2) | |
| total_price | numeric(12,2) | qty * unit_price |

**Alter `procurement_lpo`**: Add `delivery_date`, `delivery_note`, `delivered_by` columns for goods receipt tracking.

**Auto-number functions**: `generate_lpo_number(school_id)` and `generate_pv_number(school_id)` — pattern: `LPO2026-0001`, `PV2026-0001`.

RLS on new table: school-scoped via `get_user_school_id()`.

### Service Layer Updates (`procurementService.ts`)

Add missing operations:
- **LPO Items**: `getLPOItems(lpoId)`, `addLPOItem()`, `removeLPOItem()`, `recalculateLPOTotal()`
- **LPO Lifecycle**: `deliverLPO(id, deliveryNote)` — sets status to 'Delivered', creates stock Purchase transactions for each line item, updates item stock
- **Payment Voucher Lifecycle**: `approveVoucher()`, `payVoucher()` — status transitions Draft→Approved→Paid
- **Petty Cash**: `getPettyCash()`, `createPettyCash()` — use existing `procurement_pettycashtransaction` table
- **Fees In-Kind**: `getFeesInKind()`, `createFeesInKind()` — use existing `procurement_feesinkindtransaction` table
- **Supplier Ledger**: `getSupplierLedger(supplierId)` — aggregate LPOs (debits), paid vouchers (credits), fees-in-kind (credits), compute running balance
- **Stock Balances**: `getStockBalances()` — aggregate purchase/issue/adjustment per item, flag items below reorder level
- **Auto-numbering**: Call `generate_lpo_number` / `generate_pv_number` RPCs when creating documents
- **Edit/Delete**: `editSupplier()`, `deleteSupplier()`, `editItem()`, `deleteItem()` (most exist in service, need UI wiring)

### Frontend Changes — Restructured Tabs

Expand from 4 tabs to 8 tabs in `ProcurementPage.tsx`:

1. **Suppliers** — Add edit/delete actions, click row to open supplier ledger dialog
2. **Items & Categories** — Add edit/delete, show current stock balance column
3. **Purchase Orders (LPOs)** — Full lifecycle:
   - Create LPO with line items (select items from inventory, enter qty/price)
   - Auto-generate LPO number
   - Approve → Deliver (goods receipt form with delivery note) → automatically creates stock entries
   - Print LPO as a clean document
4. **Goods Receipt** — Quick view of approved LPOs awaiting delivery, one-click receive
5. **Payment Vouchers** — Full lifecycle:
   - Create linked to supplier (optionally to an LPO), select vote head
   - Auto-generate voucher number
   - Approve → Pay workflow
   - Print voucher
6. **Stock & Inventory** — Current stock levels per item, reorder alerts, issue stock (to departments/classes), stock movement history
7. **Petty Cash** — Top-ups and expenses, running balance, linked to vote heads
8. **Supplier Ledger** — Select supplier, see opening balance + all LPOs (debits) + all payments (credits) + fees-in-kind (credits) = running balance

### LPO Print Format
Clean printable document with: school header, LPO number, date, supplier details, table of line items (description, qty, unit price, total), grand total, approval signature blocks, delivery acknowledgment section.

### Payment Voucher Print Format
School header, PV number, date, payee (supplier), amount in words, payment mode, vote head, description, authorization signatures (Prepared by, Checked by, Approved by, Received by).

### Key Workflow: Purchase-to-Stock
```text
Create LPO (with items) → Approve → Deliver (Goods Receipt)
                                        ↓
                              Auto-create StockTransaction (type='Purchase')
                              for each LPO line item
                                        ↓
                              Stock balances updated automatically
```

### Integration Preservation
- **Fees module**: Vote head FK on payment vouchers and petty cash remains intact; fees-in-kind links to students and vote heads unchanged
- **Accounting module**: No changes to journal entries; payment vouchers continue to reference vote heads for expense classification
- **Existing data**: All migrations are additive (new table + nullable columns on existing tables)

### Files to Create/Edit
- **Create**: `supabase/migrations/..._procurement_lpo_items.sql`
- **Edit**: `src/services/procurementService.ts` (add ~200 lines for missing operations)
- **Rewrite**: `src/pages/ProcurementPage.tsx` (expand from 382 lines to ~1200 lines with all 8 tabs, dialogs, print functions)

