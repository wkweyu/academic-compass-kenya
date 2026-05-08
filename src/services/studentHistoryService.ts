import { supabase } from "@/integrations/supabase/client";
import { AcademicHistoryEvent, AuditEntry } from "@/types/student";

/**
 * Fetch a student's full academic history by combining promotions,
 * transfers, and the student's own admission data into a unified timeline.
 */
export const getAcademicHistory = async (
  studentId: string
): Promise<AcademicHistoryEvent[]> => {
  const numericId = parseInt(studentId, 10);

  const [promotionsResult, transfersResult, studentResult] = await Promise.all([
    supabase
      .from('student_promotions')
      .select(`
        id,
        promotion_date,
        notes,
        from_class:from_class_id(id, name),
        to_class:to_class_id(id, name)
      `)
      .eq('student_id', numericId)
      .order('promotion_date', { ascending: false }),

    supabase
      .from('student_transfers')
      .select(`
        id,
        transfer_date,
        reason,
        from_class:from_class_id(id, name),
        to_class:to_class_id(id, name),
        from_stream:from_stream_id(id, name),
        to_stream:to_stream_id(id, name)
      `)
      .eq('student_id', numericId)
      .order('transfer_date', { ascending: false }),

    supabase
      .from('students')
      .select('enrollment_date, admission_year, status')
      .eq('id', numericId)
      .single(),
  ]);

  const events: AcademicHistoryEvent[] = [];

  // Admission event (synthetic — derived from student record)
  if (studentResult.data) {
    const enrollDate =
      studentResult.data.enrollment_date ||
      `${studentResult.data.admission_year}-01-01`;
    events.push({
      id: `admission-${studentId}`,
      type: 'admission',
      date: enrollDate,
      notes: 'Student admitted to school',
    });

    // If status is graduated or archived, add synthetic terminal event
    const terminalStatus = studentResult.data.status as string;
    if (terminalStatus === 'graduated') {
      events.push({
        id: `graduation-${studentId}`,
        type: 'graduation',
        date: studentResult.data.enrollment_date || new Date().toISOString(),
        notes: 'Student graduated',
      });
    } else if (terminalStatus === 'archived') {
      events.push({
        id: `archival-${studentId}`,
        type: 'archival',
        date: new Date().toISOString(),
        notes: 'Student record archived',
      });
    }
  }

  // Promotion events
  if (promotionsResult.data) {
    for (const p of promotionsResult.data) {
      const from = (p.from_class as any)?.name ?? 'Unknown';
      const to = (p.to_class as any)?.name ?? 'Unknown';
      events.push({
        id: `promotion-${p.id}`,
        type: 'promotion',
        date: p.promotion_date,
        from,
        to,
        notes: p.notes || undefined,
      });
    }
  }

  // Transfer events
  if (transfersResult.data) {
    for (const t of transfersResult.data) {
      const fromClass = (t.from_class as any)?.name ?? '';
      const fromStream = (t.from_stream as any)?.name ?? '';
      const toClass = (t.to_class as any)?.name ?? '';
      const toStream = (t.to_stream as any)?.name ?? '';

      events.push({
        id: `transfer-${t.id}`,
        type: 'transfer',
        date: t.transfer_date,
        from: [fromClass, fromStream].filter(Boolean).join(' - '),
        to: [toClass, toStream].filter(Boolean).join(' - '),
        notes: t.reason || undefined,
      });
    }
  }

  // Sort all events descending by date
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return events;
};

/**
 * Fetch the audit log for a specific student.
 * Translates raw JSONB diffs into human-readable change lines.
 */
export const getStudentAuditLog = async (
  studentId: string
): Promise<AuditEntry[]> => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, user_id, action, old_values, new_values')
    .eq('entity_type', 'student')
    .eq('entity_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (import.meta.env.DEV) {
      console.error('getStudentAuditLog error:', error);
    }
    return [];
  }

  return (data ?? []).map((row): AuditEntry => {
    const changes = buildChangeSummary(row.old_values, row.new_values);
    return {
      id: row.id,
      date: row.created_at,
      user: row.user_id ?? 'System',
      action: row.action ?? 'update',
      changes,
    };
  });
};

// ── helpers ─────────────────────────────────────────────────────────────────

const IGNORED_KEYS = new Set(['updated_at', 'created_at']);

function buildChangeSummary(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): string[] {
  if (!newValues) return [];
  const lines: string[] = [];
  for (const key of Object.keys(newValues)) {
    if (IGNORED_KEYS.has(key)) continue;
    const prev = oldValues?.[key];
    const next = newValues[key];
    if (prev !== next) {
      const label = key.replace(/_/g, ' ');
      lines.push(`${label}: ${formatValue(prev)} → ${formatValue(next)}`);
    }
  }
  return lines;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}
