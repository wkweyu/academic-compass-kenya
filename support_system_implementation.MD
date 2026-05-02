# 🚀 AI IMPLEMENTATION PROMPT — Support Ticket System Fix & Completion

You are working on a  multi-tenant School ERP SaaS platform.

A support ticket UI already exists but submission fails and backend workflow is incomplete.

Your task is to:

* FIX broken ticket submission
* COMPLETE support ticket lifecycle
* IMPLEMENT notification + assignment system
* REUSE existing structures where possible
* DO NOT duplicate models or logic

---

# 🔒 RULES

1. ALL records must include `school_id`
2. DO NOT break existing authentication system
3. REUSE existing User model
4. USE service layer for business logic
5. ADD logging and error handling
6. ENSURE multi-tenant isolation

---

# PHASE 1 — DEBUG EXISTING SUBMISSION

1. Locate route handling ticket submission (e.g. `/support/ticket/create`)
2. Verify:

   * route exists
   * method = POST
   * CSRF token handled
3. Add logging:

   * print request payload
   * catch exceptions and log errors
4. Ensure DB session commit is executed
5. Return proper JSON response:

   ```json
   { "success": true, "message": "Ticket created" }
   ```

---

# PHASE 2 — COMPLETE SUPPORT TICKET MODEL

Ensure model includes:

* school_id
* user_id
* subject
* description
* category
* priority
* status (default = "open")
* assigned_to (nullable)
* timestamps

If model exists → extend it safely (do NOT recreate)

---

# PHASE 3 — CREATE SERVICE LAYER

Create:

```python
create_ticket(data, current_user)
assign_ticket(ticket_id, support_user_id)
resolve_ticket(ticket_id, resolver_id)
```

---

# PHASE 4 — AUTO NOTIFICATION ON CREATE

When ticket is created:

1. Identify SaaS support users (role = "support_admin")
2. Create Notification records for them
3. Optional: send email

---

# PHASE 5 — ASSIGNMENT SYSTEM

Implement:

* Admin can assign ticket
* Update:

  * assigned_to
  * status = "assigned"

---

# PHASE 6 — RESOLUTION FLOW

When resolved:

1. Update status = "resolved"
2. Save resolution note
3. Notify ticket creator

---

# PHASE 7 — NOTIFICATION SYSTEM

Implement function:

```python
send_notification(user_id, message)
```

Used for:

* ticket created
* ticket assigned
* ticket resolved

---

# PHASE 8 — FRONTEND FIX

Fix submit button:

* Ensure correct API endpoint
* Handle response:

  * success → show success message
  * error → show error message

---

# PHASE 9 — ERROR HANDLING

Handle:

* DB failures
* missing fields
* invalid user
* tenant mismatch

---

# PHASE 10 — TESTING

Test:

* ticket creation
* assignment
* resolution
* notification delivery
* multi-tenant isolation

---

# ✅ SUCCESS CRITERIA

✔ Ticket submits successfully
✔ No frontend error
✔ Ticket saved with correct school_id
✔ SaaS admin notified
✔ Ticket can be assigned
✔ User notified on resolution
✔ No duplicate models created

---

# 🔥 IMPORTANT

Before writing new code:

* SEARCH existing ticket-related code
* REUSE models and routes
* EXTEND instead of replacing
* AVOID breaking current functionality


Optional Enhancements (Highly Recommended)

Once this works, add:

SLA timers (urgent = faster response)
ticket priority escalation
file attachments
audit logs
dashboard (open vs resolved tickets)
---

