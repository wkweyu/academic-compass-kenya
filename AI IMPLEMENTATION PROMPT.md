# 🚀 AI IMPLEMENTATION PROMPT — Secure Support Operations System

You are enhancing a multi-tenant School ERP SaaS system.

Support staff must be able to resolve issues WITHOUT direct database access.

---

# 🔒 RULES

1. NEVER allow raw SQL execution by support users
2. ALL actions must be tenant-scoped (`school_id`)
3. ALL actions must be logged (audit trail)
4. REUSE existing models and services
5. IMPLEMENT role-based access control

---

# PHASE 1 — SUPPORT IMPERSONATION

Implement:

```python
start_impersonation(school_id, support_user_id)
end_impersonation()
```

Requirements:

* set tenant context
* restrict access to selected school
* log impersonation start/end

---

# PHASE 2 — SUPPORT AUDIT LOG

Create model:

* support_user_id
* school_id
* action
* affected_model
* before_data
* after_data
* timestamp

Log ALL support actions

---

# PHASE 3 — SUPPORT ACTION SERVICES

Create structured services instead of DB edits:

Examples:

* adjust_student_balance()
* reprocess_payment()
* reverse_transaction()
* reset_user_password()

Each must:

* validate tenant
* log changes
* use existing business logic

---

# PHASE 4 — READ-ONLY DEBUG MODE

Allow support to:

* view student data
* view transactions
* run diagnostics

Restrict write actions unless explicitly triggered

---

# PHASE 5 — TICKET INTEGRATION

Enhance ticket workflow:

* assign ticket
* support enters tenant via impersonation
* performs action
* logs activity
* resolves ticket

---

# PHASE 6 — PERMISSIONS

Ensure:

* only support_admin role can impersonate
* sensitive actions require higher privileges

---

# PHASE 7 — SAFETY CONTROLS

* prevent cross-tenant access
* validate all IDs belong to tenant
* prevent mass updates

---

# PHASE 8 — UI (OPTIONAL)

Add:

* "Enter School" button (impersonation)
* "Run Fix" buttons (support actions)
* audit log viewer

---

# ✅ SUCCESS CRITERIA

✔ Support resolves issues without DB access
✔ All actions logged
✔ No cross-tenant data leaks
✔ Safe impersonation works
✔ System uses structured fixes instead of manual edits

---

# 🔥 IMPORTANT

Before creating new tools:

* search for existing services (fees, payments, users)
* reuse them
* NEVER bypass business logic

---

