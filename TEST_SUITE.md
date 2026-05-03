# TEST SUITE — ACCEPTANCE TESTS

## 1. Determinism

TEST:
Same seed + same DB state
→ Output MUST be identical

---

## 2. Teacher Conflict

TEST:
Teacher assigned in 2 classes same slot
→ MUST NOT happen

---

## 3. Daily Load Limit

TEST:
Teacher reaches maxPeriodsPerDay
→ No further assignments allowed

---

## 4. Double Periods

TEST:
Double lesson assigned
→ MUST be consecutive and non-break

---

## 5. Blackout Enforcement

TEST:
Blackout defined for a slot
→ No assignment in ANY path

---

## 6. Starvation

TEST:
Task fails repeatedly
→ Moves to retryQueue
→ Appears in unassigned if still failing

---

## 7. Micro-backtracking

TEST:
Tight scenario
→ Backtracking reduces conflicts

---

## 8. Timeout

TEST:
Large dataset
→ Returns timedOut = true
→ Partial results preserved

---

## 9. Feasibility

TEST:
Required > available
→ class marked 'impossible'
→ skipped

---

## 10. Two-phase Save

TEST:
Failure during save
→ ALL staging records deleted

---

## 11. Idempotency

TEST:
Same generationId used twice
→ No duplicate rows

---

## 12. Global Conflicts

TEST:
Cross-class overlap
→ Appears in globalConflicts
