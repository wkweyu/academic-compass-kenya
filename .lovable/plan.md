

# Transport Module Implementation Plan

## Current State

**What exists:**
- **Database**: `transport_transportroute` table with columns: `id`, `name`, `one_way_charge`, `two_way_charge`, `description`, `school_id` (empty, no routes created yet)
- **Students table**: Has `is_on_transport` (boolean), `transport_route_id` (FK to transport_transportroute), `transport_type` (varchar: one_way/two_way)
- **Student Form**: Has transport toggle, but route selection is a raw number input instead of a dropdown from actual routes
- **Sidebar**: Transport link exists at `/transport`, currently points to `ComingSoonPage`
- **Django backend**: Full transport models, serializers, views exist but are irrelevant (Supabase is the backend)
- **Fees integration**: `fees_votehead` table exists with priority system; transport charges should be posted as debits against a "Transport" votehead

## What Needs to Be Built

### 1. Transport Management Page (`src/pages/TransportPage.tsx`)
Full CRUD module with tabs:
- **Routes**: List/Add/Edit/Delete transport routes (name, one_way_charge, two_way_charge, description)
- **Students**: View all students assigned to transport, filter by route/type, assign/unassign students
- **Reports**: Transport charge report per route, billing summary per term

### 2. Transport Service (`src/services/transportService.ts`)
- CRUD for `transport_transportroute` (scoped to school)
- Fetch students on transport with route details
- Assign/unassign students to routes
- Auto-post transport debit to student's fee account when assigned (using `fees_votehead` with name "Transport")
- Generate transport billing reports

### 3. Fix Student Form Transport Section
- Replace the raw number input for "Transport Route" with a **dropdown** that fetches routes from `transport_transportroute`
- Show the route name and charge based on selected transport type
- On student save, if transport is enabled, auto-create a fee debit for the transport votehead

### 4. Route the Transport Page
- Replace `ComingSoonPage` in `App.tsx` with the new `TransportPage` component

### 5. Fees Integration
- When a student is assigned to a transport route, automatically debit the appropriate charge (one_way or two_way) to their fee account under a "Transport" votehead
- When unassigned, optionally reverse the debit
- Transport charges appear in the fees register and student statements

## Technical Details

### Database
- No schema changes needed — `transport_transportroute` and student transport columns already exist
- RLS policies needed for `transport_transportroute`: school-scoped read/write for authenticated users

### Files to Create
- `src/pages/TransportPage.tsx` — page wrapper
- `src/services/transportService.ts` — service layer for transport CRUD and reports
- `src/components/modules/TransportModule.tsx` — main tabbed module (Routes, Students, Reports)

### Files to Modify
- `src/App.tsx` — replace ComingSoonPage with TransportPage
- `src/components/forms/StudentForm.tsx` — route dropdown from DB instead of number input
- `src/services/studentService.ts` — join transport route on student fetch to get route name/charges

### RLS Migration
```sql
ALTER TABLE transport_transportroute ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transport routes for their school"
ON transport_transportroute FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id());

CREATE POLICY "Users can manage transport routes for their school"
ON transport_transportroute FOR ALL TO authenticated
USING (school_id = public.get_user_school_id())
WITH CHECK (school_id = public.get_user_school_id());
```

