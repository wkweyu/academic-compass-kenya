# IMPLEMENTATION TASKS — STRICT ORDER

## Phase 1 — Database

[ ] Add 'staging' to timetable status
[ ] Add generation_id column
[ ] Add partial unique index for idempotency

---

## Phase 2 — Types

[ ] Add 'staging' to TimetableStatus
[ ] Add UnassignedSubject type
[ ] Add ClassGenerationResult
[ ] Add SchoolGenerationResult
[ ] Extend GenerationResult with timeout + seed

---

## Phase 3 — Edge Function Core

### Determinism

[ ] Implement mulberry32(seed)
[ ] Replace ALL Math.random()

### Data Handling

[ ] Implement single Promise.all data load
[ ] Sort all inputs deterministically

### Maps

[ ] Implement teacherOccupancyMap
[ ] Implement roomOccupancyMap
[ ] Implement teacherDailyLoadMap
[ ] Implement teacherWeeklyLoadMap
[ ] Implement roomUsageMap

### Core Logic

[ ] Implement global scheduling queue
[ ] Implement starvation retryQueue
[ ] Implement candidate scoring system
[ ] Implement atomic room allocation
[ ] Implement blackout enforcement

### Advanced

[ ] Implement micro-backtracking (bounded)
[ ] Implement predictive timeout
[ ] Implement feasibility classification

### Output

[ ] Implement combined conflict detection
[ ] Return structured SchoolGenerationResult

---

## Phase 4 — Service Layer

[ ] Implement generateSchoolTimetable()
[ ] Implement saveSchoolGeneratedTimetables()
[ ] Implement two-phase save logic
[ ] Implement rollback on failure

---

## Phase 5 — UI

[ ] Add school/class toggle
[ ] Add seed input
[ ] Add summary table view
[ ] Add feasibility indicators
[ ] Add timeout warning
[ ] Add Save All flow

---

## Phase 6 — Integration

[ ] Connect UI to service layer
[ ] Handle result rendering
[ ] Handle failure reporting

---

## Phase 7 — Validation

[ ] Run deterministic tests
[ ] Run overload scenarios
[ ] Run timeout scenarios
[ ] Run rollback scenarios
