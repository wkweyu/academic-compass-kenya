/**
 * Shared timetable display formatting utilities.
 *
 * Centralising these here ensures that the grid card display and the CSV
 * export always produce exactly the same codes/labels — no drift.
 */

export interface TeacherLike {
  id: number;
  first_name: string;
  last_name: string;
}

/**
 * Builds a Map<teacherId, displayCode> from an array of slot-like objects.
 *
 * Algorithm (3-pass):
 *  1. Collect unique teachers from the slots.
 *  2. Assign raw 2-letter initials (FF+LL, upper-cased; falls back to '??').
 *  3. Detect any base that is used more than once, then re-number ALL
 *     occurrences of that base: JN → JN1, JN2, …  (not JN + JN2).
 */
export function makeTeacherDisplayMap(
  slots: { teacher?: TeacherLike | null; teacher_id?: number | null }[]
): Map<number, string> {
  // Pass 1 — unique teachers, preserving insertion order
  const teachers = new Map<number, TeacherLike>();
  for (const s of slots) {
    if (s.teacher && !teachers.has(s.teacher.id)) {
      teachers.set(s.teacher.id, s.teacher);
    }
  }

  // Pass 2 — assign raw initials; tally how often each base appears
  const rawInitials = new Map<number, string>();
  const baseCount = new Map<string, number>();
  for (const [id, t] of teachers) {
    const f = (t.first_name?.trim() ?? '')[0] ?? '';
    const l = (t.last_name?.trim() ?? '')[0] ?? '';
    const base = (f + l).toUpperCase() || '??';
    rawInitials.set(id, base);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }

  // Pass 3 — re-number colliding bases; assign final codes
  const result = new Map<number, string>();
  const baseSeq = new Map<string, number>(); // running sequence per base
  for (const [id, base] of rawInitials) {
    if ((baseCount.get(base) ?? 1) > 1) {
      const seq = (baseSeq.get(base) ?? 0) + 1;
      baseSeq.set(base, seq);
      result.set(id, `${base}${seq}`);
    } else {
      result.set(id, base);
    }
  }
  return result;
}

/**
 * Returns the best short label for a subject: code if non-empty, else name,
 * else a fallback dash.
 */
export function subjectDisplay(
  subject?: { name: string; code: string } | null
): string {
  return subject?.code?.trim() || subject?.name || '—';
}
