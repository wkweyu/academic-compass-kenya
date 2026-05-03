# TIMETABLE MODULE — FORMAL SPECIFICATION

## 1. Scope

This specification defines the complete behavior of the school-wide timetable generation system.

The system MUST support:

* Class-level generation (existing behavior)
* School-wide generation (new behavior with shared constraints)

---

## 2. Core Principles

### 2.1 Determinism

* The generator MUST use a seeded PRNG (mulberry32)
* The generator MUST NOT use `Math.random()`
* Same input + same seed MUST produce identical output

---

### 2.2 Global Constraint Enforcement

* Teacher occupancy MUST be enforced across ALL classes
* Special room occupancy MUST be enforced globally
* Locked slots MUST NEVER be modified
* Blackout periods MUST NEVER receive assignments

---

### 2.3 Hard Constraints (MUST NEVER BE VIOLATED)

* Teacher cannot be assigned to multiple classes at same day+period
* Special room cannot be double-booked
* Teacher daily load MUST NOT exceed `maxPeriodsPerDay`
* Double lessons MUST be consecutive and non-break
* No assignment during blackout slots

---

### 2.4 Soft Constraints (Scored, Not Blocking)

* Subject spread across days
* Avoid back-to-back same subject
* Teacher weekly overload
* Idle gaps

---

## 3. School-wide Generation Architecture

### 3.1 Global Scheduling Queue

The system MUST:

* Flatten all class_subjects into a global task queue
* Sort tasks by:

  1. priority DESC
  2. periods_per_week DESC
  3. requires_special_room DESC

Each task MUST track:

* remainingPeriods
* attempts
* totalAttempts
* maxTotalAttempts = periods_per_week × 10

---

### 3.2 Shared Maps (Single Source of Truth)

The system MUST maintain:

* teacherOccupancyMap → `${teacherId}_${day}_${periodId}`
* roomOccupancyMap → `${roomId}_${day}_${periodId}`
* teacherDailyLoadMap → `${teacherId}_${day}`
* teacherWeeklyLoadMap → `${teacherId}`
* roomUsageMap → `${roomId}`

All maps MUST be seeded from:

* Existing DB occupancy
* Locked slots (ALL classes)

---

### 3.3 Atomic Room Allocation

Room assignment MUST use:

* `atomicAssignRoom()`
* `atomicReleaseRoom()`

These MUST:

* Update occupancy AND usage maps together
* NEVER update one without the other

---

### 3.4 Double Period Handling

* Double periods MUST be precomputed using valid consecutive pairs
* MUST NOT span breaks
* MUST NOT be computed inline

---

### 3.5 Blackout Enforcement

* Blackouts MUST be applied via a central `blackoutSet`
* MUST be checked in:

  * main assignment loop
  * double-period assignment
  * micro-backtracking

---

### 3.6 Feasibility Classification

Each class MUST be classified:

* `impossible` → skipped entirely
* `tight` → <15% buffer
* `ok` → normal

---

### 3.7 Starvation Protection

* After 5 failed attempts → task moves to retryQueue
* Retry queue MUST boost priority by +1
* MUST NOT loop indefinitely

---

### 3.8 Micro-backtracking

* MUST rollback last 3–5 assignments
* MUST NOT exceed 50 total operations
* MUST NEVER rollback locked or DB-loaded slots

---

### 3.9 Timeout Control

* Hard timeout: 50 seconds
* Predictive timeout MUST stop early if estimated overflow
* MUST return partial results with `timedOut = true`

---

## 4. Output Contract

### 4.1 Response MUST include:

* results[]
* globalConflicts[]
* executionTime
* timedOut
* seed

### 4.2 Per-class result MUST include:

* feasibility
* slotsFilled
* slotsRequired
* unassigned[]
* conflicts[]

---

## 5. Persistence Model

### 5.1 Two-phase Save (MANDATORY)

1. Insert all timetables as `staging`
2. If ALL succeed → promote to `draft`
3. If ANY fail → rollback ALL

---

### 5.2 Idempotency

* generation_id MUST prevent duplicate saves
* ON CONFLICT MUST update, not insert duplicates

---

## 6. Audit Logging

System MUST log:

* generation start
* generation end

---

## 7. Non-Negotiable Rules

* No silent failures
* No skipped constraints
* No partial persistence
* No nondeterministic behavior

Violation of any rule = invalid implementation
