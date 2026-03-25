# SaaS Billing Redesign Plan

## Objective

Redesign billing as a coordinated SaaS lifecycle for schools from onboarding to trial conversion, invoicing, payment collection, and service enforcement.

The current codebase already has useful billing primitives, but they operate as isolated admin actions. The redesign should establish one authoritative billing model, one billing workflow, and clear automation boundaries.

## Current State Summary

### Existing Assets

- Plan catalog exists in `subscription_plans`.
- Contract history exists in `subscriptions`.
- Invoice ledger exists in `saas_invoices`.
- Communication history exists in `saas_communications`.
- School access gating currently depends on fields stored on `schools_school` such as `subscription_plan`, `subscription_status`, `subscription_start`, and `subscription_end`.
- Billing automation already exists for:
  - renewal invoice generation
  - overdue invoice processing
  - payment recording
  - reminder sending
- Platform UI already exposes:
  - manual invoice generation
  - manual send notification
  - manual payment recording
  - trial extension
  - subscription extension

### Current Structural Problems

1. Billing truth is split across multiple places.
   - `schools_school` stores the current subscription state.
   - `subscriptions` stores historical subscription records.
   - `saas_invoices` stores receivables.
   - These can drift from each other.

2. Lifecycle states are implicit instead of modeled.
   - Onboarding, trial, active paid, renewal due, grace period, suspended, and churned are not represented as a single state machine.

3. Pricing is duplicated.
   - SQL-seeded pricing in `subscription_plans` does not match frontend fallback values in `src/services/saasService.ts`.

4. The dashboard acts like a billing engine.
   - Operators can mutate billing state directly through one-off actions instead of executing controlled workflows.

5. Invoice semantics are incomplete.
   - There is no first-class distinction between onboarding fee invoices, recurring subscription invoices, prorations, credits, waivers, or manual adjustments.

6. Collections are notification-based, not policy-based.
   - Reminders exist, but follow-up cadence, grace rules, and service restriction rules are not coordinated.

## Target Architecture

### Billing Principles

1. One source of truth for the commercial relationship.
2. Explicit lifecycle states and transitions.
3. Invoices and payments form the accounting ledger.
4. School access status is derived from billing state, not edited ad hoc.
5. UI triggers workflows; backend decides state transitions.
6. Pricing and entitlement rules live only in backend-managed records.

### Domain Model

The redesign should separate five concerns.

#### 1. Customer Account

Represents the school as a SaaS customer.

Recommended table: `billing_accounts`

Core fields:
- `id`
- `school_id`
- `account_status`
- `billing_owner_user_id`
- `billing_email`
- `currency`
- `country`
- `tax_profile`
- `collection_status`
- `created_at`
- `updated_at`

Notes:
- One school should have one billing account.
- This becomes the anchor for invoices, subscriptions, payment terms, and collections.

#### 2. Subscription Contract

Represents the commercial agreement for plan, term, and entitlement period.

Recommended table: `billing_subscriptions`

Core fields:
- `id`
- `billing_account_id`
- `plan_id`
- `subscription_status`
- `billing_cycle`
- `term_start`
- `term_end`
- `auto_renew`
- `renewal_mode`
- `price_snapshot`
- `trial_starts_at`
- `trial_ends_at`
- `grace_ends_at`
- `cancelled_at`
- `cancel_reason`
- `created_from`

Notes:
- This table replaces `schools_school` as the source of subscription truth.
- Existing `subscriptions` can be migrated into this model or retained as a compatibility view during migration.

#### 3. Invoice Ledger

Represents receivables and billing documents.

Extend `saas_invoices` or replace with `billing_invoices`.

Required additions:
- `invoice_type` with values such as `onboarding`, `subscription`, `proration`, `adjustment`, `credit_note`
- `invoice_status` with values such as `draft`, `issued`, `partially_paid`, `paid`, `void`, `overdue`, `written_off`
- `currency`
- `subtotal`
- `tax_amount`
- `total_amount`
- `balance_due`
- `issued_at`
- `last_reminder_at`
- `next_follow_up_at`
- `collection_stage`

Notes:
- Do not use invoice rows to infer subscription state directly.
- Invoices should reference the subscription contract they bill.

#### 4. Payment Ledger

Represents actual money received.

Recommended table: `billing_payments`

Core fields:
- `id`
- `billing_account_id`
- `invoice_id`
- `amount`
- `currency`
- `payment_method`
- `payment_reference`
- `payment_channel`
- `received_at`
- `recorded_by`
- `reconciliation_status`
- `notes`

Notes:
- Current `record_invoice_payment` behavior should become a payment-posting workflow.
- Posting a payment updates invoice balance and may trigger subscription activation or renewal.

#### 5. Billing Event Log

Represents authoritative state transitions.

Recommended table: `billing_events`

Core fields:
- `id`
- `billing_account_id`
- `subscription_id`
- `invoice_id`
- `payment_id`
- `event_type`
- `event_payload`
- `occurred_at`
- `created_by`

Notes:
- This becomes the audit layer for lifecycle transitions.
- Existing audit logging helpers can continue to write to `audit_logs`, but billing automation should also write explicit domain events.

## Lifecycle Model

### Account Lifecycle

Recommended lifecycle:

1. `lead`
2. `onboarding_pending`
3. `trial_pending_setup`
4. `trial_active`
5. `trial_expiring`
6. `payment_pending`
7. `active`
8. `renewal_due`
9. `grace_period`
10. `past_due`
11. `suspended`
12. `cancelled`
13. `churned`

Rules:
- Only backend workflows can move between these states.
- Dashboard actions should request a transition, not write state fields directly.

### Invoice Lifecycle

1. `draft`
2. `issued`
3. `delivered`
4. `partially_paid`
5. `paid`
6. `overdue`
7. `void`
8. `written_off`

### Collections Lifecycle

1. `none`
2. `upcoming_reminder`
3. `first_reminder`
4. `second_reminder`
5. `final_notice`
6. `grace`
7. `suspension_warning`
8. `suspended`
9. `recovery`

## End-to-End Workflow

### 1. Onboarding

Target flow:

1. Create school.
2. Create billing account.
3. Create subscription contract in `trial_active` or `payment_pending` depending on sales policy.
4. Snapshot pricing from the chosen plan.
5. Generate either:
   - onboarding invoice only,
   - onboarding plus first term invoice, or
   - no invoice for free trial flow.
6. Schedule automated reminders based on trial and due dates.
7. Expose one billing summary for the school.

Design decision:
- Onboarding must create billing records transactionally alongside school creation.
- The system should not rely on later manual invoice generation for newly onboarded schools.

### 2. Trial Management

Target rules:

- Trial period is defined on the subscription contract, not only on `schools_school.subscription_end`.
- Trial extensions require a reason and should create a billing event.
- Trial expiry should auto-transition to `trial_expiring`, then `payment_pending` or `suspended` depending on policy.
- Renewal invoice generation should not be used for trial conversion unless the plan rules explicitly say so.

### 3. Invoice Generation

Target rules:

- Invoices are generated from billing policy and subscription terms.
- Invoice creation should support templates:
  - onboarding fee
  - first subscription charge
  - annual renewal
  - monthly renewal
  - proration
  - manual adjustment
- Line items should be structured, not freeform-only JSON from the UI.

### 4. Payment Posting

Target flow:

1. Record payment.
2. Match payment to invoice.
3. Update invoice balance.
4. If invoice is fully settled, post billing event.
5. Activate or extend subscription only through billing policy.
6. Generate receipt communication.

Design decision:
- Payment posting should not directly guess a new term end date without referencing the subscription contract, billing cycle, and invoice period.

### 5. Renewal and Collections

Target flow:

1. Pre-renewal reminder before term end.
2. Renewal invoice issuance at policy-defined offset.
3. Reminder cadence based on invoice age and collection stage.
4. Grace window after due date.
5. Suspension warning.
6. Access suspension if still unpaid.
7. Service restoration on successful payment.

### 6. Service Enforcement

Target rules:

- Access checks should derive entitlement from billing subscription state.
- `check_subscription_status()` should become a read model over billing account plus active subscription contract.
- School login and core product access should respect grace and suspension policy consistently.

## What To Reuse

### Keep With Refactoring

- `subscription_plans`
- `saas_communications`
- `send_billing_notification`
- `send_pending_renewal_notifications`
- `send_overdue_reminders`
- `audit_logs`
- platform access controls and billing console permissions

### Convert To Compatibility Layer

- `subscriptions`
- `check_subscription_status()`
- `get_school_subscription_history()`
- `extend_trial()`
- `extend_subscription_period()`
- `record_invoice_payment()` and `record_invoice_payment_v2()`

These should continue to work during migration, but they should call new billing workflows instead of mutating school fields directly.

### Stop Using As Billing Truth

- `schools_school.subscription_plan`
- `schools_school.subscription_status`
- `schools_school.subscription_start`
- `schools_school.subscription_end`

These fields can remain temporarily as a denormalized read model, but they should no longer be the canonical contract state.

## Frontend Redesign

### Current UI Problem

The dashboard exposes discrete actions:
- extend trial
- extend plan
- generate invoice
- send notification
- record payment

This is operationally convenient, but it encourages state drift.

### Target UI Structure

Each school billing view should be reorganized into:

1. `Account Summary`
   - account status
   - active plan
   - current term
   - trial/grace dates
   - balance due
   - next billing event

2. `Contract`
   - plan
   - billing cycle
   - price snapshot
   - renewal behavior
   - entitlement limits

3. `Invoices`
   - issue invoice
   - view balance
   - delivery status
   - collection stage

4. `Payments`
   - record payment
   - reconciliation status
   - payment history

5. `Collections`
   - reminder timeline
   - next scheduled follow-up
   - grace or suspension status

6. `Timeline`
   - onboarding completed
   - trial started
   - invoice issued
   - reminder sent
   - payment received
   - service restored or suspended

### Frontend Service Rules

- Remove pricing fallbacks that diverge from backend catalog.
- Introduce backend DTOs that return full billing snapshots.
- Replace action-first methods with workflow-first methods such as:
  - `createBillingAccountForSchool`
  - `startSchoolTrial`
  - `issueSubscriptionInvoice`
  - `postInvoicePayment`
  - `applyBillingDecision`
  - `getBillingAccountSnapshot`

## Implementation Phases

### Phase 1: Billing Model Cleanup

Goal:
- Introduce canonical billing tables without breaking existing UI.

Work:
- create `billing_accounts`
- create `billing_subscriptions`
- create `billing_payments`
- create `billing_events`
- extend invoices with explicit invoice and collection metadata
- backfill from `schools_school`, `subscriptions`, and `saas_invoices`
- create read views for current UI compatibility

Exit criteria:
- every school with SaaS access has a billing account and one active or last-known subscription contract

### Phase 2: Workflow Layer

Goal:
- Move business decisions into backend workflows.

Work:
- add RPCs or backend endpoints for:
  - onboarding billing initialization
  - trial start and trial extension
  - invoice issuance
  - payment posting
  - renewal processing
  - suspension and restoration
- refactor old RPCs to delegate to new workflows
- define policy constants for reminder offsets, grace period, and suspension rules

Exit criteria:
- no billing state changes require direct field mutation on `schools_school`

### Phase 3: Dashboard Redesign

Goal:
- Replace manual action clusters with billing workflows and snapshots.

Work:
- build a billing account summary panel
- build timeline and collections views
- replace manual invoice form with invoice templates and billing actions
- replace generic payment button with a payment-posting dialog
- display derived status, not raw school subscription fields

Exit criteria:
- dashboard reflects backend billing state consistently and operators no longer need to infer account condition manually

### Phase 4: Automation and Enforcement

Goal:
- Complete the lifecycle from invoice issuance to service enforcement.

Work:
- schedule reminder automation around collection stages
- apply grace and suspension transitions automatically
- restore service automatically after payment where policy allows
- add receipt and confirmation communications
- expose billing health metrics

Exit criteria:
- unpaid accounts progress through reminders, grace, and suspension automatically

### Phase 5: Reporting and Reconciliation

Goal:
- make finance operations observable.

Work:
- aging report
- cash collection report
- trial conversion report
- churn and recovery report
- failed collection report
- mismatch report for invoices vs payments vs subscription state

## Highest-Risk Gaps To Fix First

1. Pricing drift between backend and frontend.
2. Payment posting that extends service without using an authoritative contract model.
3. Subscription truth split between `schools_school` and `subscriptions`.
4. Invoice statuses that do not distinguish issuance, delivery, and collection progression.
5. Manual onboarding that can leave a school created without a coherent billing record.

## Recommended Immediate Build Order

1. Define canonical billing schema.
2. Backfill billing accounts and subscription contracts.
3. Create `get_billing_account_snapshot` read model.
4. Rewrite payment posting as contract-aware workflow.
5. Rewrite onboarding to initialize billing automatically.
6. Refactor dashboard to consume billing snapshot.
7. Replace direct extension actions with policy-driven actions.

## File-Level Impact

Expected primary implementation areas:

- `supabase/migrations/` for canonical billing schema and backfills
- `src/services/saasService.ts` for new billing workflow methods and removal of pricing drift
- `src/pages/SaaSDashboardPage.tsx` for billing snapshot UI and workflow actions
- `apps/schools/services.py` for onboarding-driven billing initialization if Django remains the orchestration layer
- `apps/schools/views.py` for any backend-triggered onboarding billing endpoints

## Recommendation

Do not attempt a full billing rewrite directly inside the existing manual dashboard actions.

The correct sequence is:

1. stabilize the billing data model
2. centralize lifecycle workflows
3. migrate the dashboard to those workflows
4. then turn on stricter automation and enforcement

This keeps rollout risk controlled and avoids breaking onboarding, access control, or invoice history while the new billing system is being introduced.