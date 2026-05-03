# Timetable Module — Production Implementation Guide

## 📌 Overview

This document defines the full implementation plan for a **Timetable Module** in a School ERP system.

### Stack

* Frontend: React + TypeScript (Vite)
* Backend: Supabase (PostgREST + Edge Functions)
* Drag & Drop: @dnd-kit
* Architecture: Modular (aligned with existing modules like TeacherManagement, Attendance)

---

## 🎯 Core Design Decisions

* Classes act as their own rooms (no classroom allocation)
* Teachers assumed globally available (no availability table)
* Timetables scoped by **class + stream + term + year**
* Auto-generation handled via **Edge Functions**
* Manual editing supported with conflict detection
* Versioning enabled (non-destructive updates)

---

# 🧱 PHASE 1 — DATABASE SCHEMA

## 1. Extend Existing Table: `class_subjects`

Add:

* stream_id (nullable FK)
* is_double (boolean)
* requires_special_room (boolean)
* preferred_room_type (enum)
* priority (int, default 0)

Constraint:

* UNIQUE(class_id, stream_id, subject_id)

---

## 2. New Tables

### school_periods

Defines daily time slots.

* id (UUID)
* school_id
* name
* start_time, end_time
* order_index
* is_break
* days_of_week (int[])

---

### special_rooms

For labs/halls only.

* id, school_id
* name
* capacity
* room_type
* is_active

---

### school_calendar_events

Blackout periods.

* id, school_id
* title
* event_type
* start_date, end_date
* affected_class_ids (optional)
* affected_period_ids (optional)
* academic_year, term

---

### timetables

Versioned timetable container.

* id
* class_id, stream_id
* academic_year, term
* version
* status (draft/published/archived)
* parent_version_id
* updated_at (for optimistic locking)

---

### timetable_slots

Individual scheduled entries.

* id
* timetable_id
* period_id
* day_of_week
* subject_id
* teacher_id
* special_room_id (nullable)
* is_locked
* updated_at

---

### timetable_substitutions

* slot_id
* date
* original_teacher_id
* substitute_teacher_id
* subject_id
* status

---

### timetable_audit_logs

* timetable_id
* action
* user_id
* timestamp
* changes (JSON)

---

## 3. Helper Functions (SQL)

Create:

* get_teacher_occupied_slots(teacher_ids[])
* get_special_room_occupied_slots(room_ids[])
* get_teacher_weekly_load(teacher_ids[])
* is_teacher_qualified(teacher_id, subject_id)

---

# ⚙️ PHASE 2 — TYPESCRIPT TYPES

Create file:

```
src/types/timetable.ts
```

Define:

* Timetable
* TimetableSlot
* TimetableConflict
* SchedulingConstraints
* GenerationResult

Include:

* Hard vs Soft conflict types
* Maps for occupancy tracking

---

# 🔧 PHASE 3 — SERVICE LAYER

Create:

```
src/services/timetableService.ts
```

## Required Functions

### Timetables

* getTimetable()
* getTimetableVersions()
* duplicateTimetable()
* saveTimetableSlots()
* updateSlot()

### Supporting

* getSchoolPeriods()
* getSpecialRooms()
* getCalendarEvents()
* getBlackoutSlots()

### Substitutions

* getQualifiedAvailableTeachers()
* createSubstitution()

---

# 🧠 PHASE 4 — GENERATION ENGINE

## Location

```
supabase/functions/generate-timetable/index.ts
```

## Input

```json
{
  "classId": number,
  "streamId": number,
  "term": number,
  "year": number,
  "constraints": {},
  "preserveLocked": boolean
}
```

---

## Algorithm

### Step 1: Load Data

* class_subjects
* school_periods (exclude breaks)
* existing locked slots
* teacher occupancy
* room occupancy
* blackout slots

---

### Step 2: Initialize

* assignedCount map
* occupancy maps

---

### Step 3: Sort Subjects

Priority:

1. priority DESC
2. periods_per_week DESC
3. requires_special_room

---

### Step 4: Assignment Loop

For each subject:

* Ensure assignedCount ≤ required

If double:

* Find consecutive slots

Else:

* Evaluate all candidate slots

Score candidates based on:

* subject repetition
* teacher overload
* idle gaps
* distribution

Pick lowest score.

---

### Step 5: Backtracking

* Undo last assignment if stuck
* Stop after max attempts
* Add to unassigned[]

---

### Step 6: Post-processing

* Detect conflicts
* Return:

```
{
  slots,
  conflicts,
  unassigned
}
```

---

# 🔁 PHASE 5 — SUBSTITUTION ENGINE

## Location

```
supabase/functions/assign-substitution/index.ts
```

## Steps

1. Validate teacher qualification
2. Check availability
3. Insert substitution
4. Trigger notification

---

# 🔒 PHASE 6 — CONCURRENCY CONTROL

* Use `updated_at`
* Reject save if mismatch
* Return HTTP 409
* UI must reload latest version

---

# 🖥️ PHASE 7 — FRONTEND

## Routing

* /timetable
* /timetable/teacher
* /timetable/room
* /timetable/periods
* /timetable/substitutions

---

## Core Components

* TimetableGrid
* TimetableSlotCard
* SlotEditDialog
* ConflictBanner
* GenerateTimetableDialog
* VersionPickerDialog
* UndoRedoToolbar

---

## Features

* Drag & drop editing
* Conflict highlighting
* Undo/redo
* Version switching
* CSV export + print

---

# 📊 PHASE 8 — REPORTING

Include:

* Teacher workload
* Room usage
* Subject distribution
* Unassigned subjects

---

# 👨‍🎓 PHASE 9 — STUDENT PORTAL

* Read-only timetable
* Only published data visible

---

# ⚠️ CRITICAL RULES

## Hard Constraints (must NEVER break)

* Teacher double-booking
* Room double-booking
* Double lessons must be consecutive
* Blackout periods

---

## Soft Constraints (optimize)

* Subject distribution
* Teacher workload
* Idle gaps

---

# ✅ VALIDATION CHECKLIST

* No subject exceeds required periods
* No hard conflicts in generated timetable
* Locked slots preserved
* Versioning works
* Concurrency conflicts handled
* Substitutions respect qualification

---

# 🚀 IMPLEMENTATION ORDER

1. Database migrations
2. TypeScript types
3. Service layer
4. Generator function
5. UI components
6. Substitution engine
7. Reports + portal

---

# 📌 NOTES FOR COPILOT

* Do NOT hardcode values
* Always use service layer for DB access
* Keep generator logic modular
* Prioritize readability over cleverness
* Return partial results instead of failing completely

---

## END OF SPEC
