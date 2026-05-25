import { supabase } from "@/integrations/supabase/client";
import { updateStudent } from "@/services/studentService";
import { StudentLifecycleStatus, LifecycleTransitionRequest } from "@/types/student";

/**
 * Valid lifecycle transitions.
 * A missing entry means the transition is forbidden.
 */
const VALID_TRANSITIONS: Partial<
  Record<StudentLifecycleStatus, StudentLifecycleStatus[]>
> = {
  active:      ['inactive', 'suspended', 'transferred', 'graduated', 'archived'],
  inactive:    ['active', 'archived'],
  suspended:   ['active', 'archived'],
  transferred: [],
  graduated:   [],
  archived:    [],
};

/**
 * Attempt a status transition for a student.
 * Guards against invalid transitions (e.g. graduated → active).
 * Writes an audit_log entry on success.
 */
export const transitionStudentStatus = async (
  request: LifecycleTransitionRequest
): Promise<void> => {
  const { studentId, fromStatus, toStatus, reason, performedBy } = request;

  // Guard: terminal states cannot transition
  const allowed = VALID_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid transition: cannot move student from "${fromStatus}" to "${toStatus}".`
    );
  }

  // Update student status
  await updateStudent(studentId, { status: toStatus as any });

  // Write audit log entry — best-effort (do not block on failure)
  try {
    await supabase.from('audit_logs').insert({
      entity_type: 'student',
      entity_id: studentId,
      action: resolveActionName(toStatus),
      module: 'students',
      old_values: { status: fromStatus },
      new_values: { status: toStatus },
      ...(reason ? { notes: reason } : {}),
      ...(performedBy ? { user_id: performedBy } : {}),
      created_at: new Date().toISOString(),
    });
  } catch (auditError) {
    if (import.meta.env.DEV) {
      console.warn('Audit log insert failed (non-fatal):', auditError);
    }
  }
};

// Map destination status to a readable action name for audit logs
function resolveActionName(toStatus: StudentLifecycleStatus): string {
  const map: Record<StudentLifecycleStatus, string> = {
    active:      'reinstatement',
    inactive:    'deactivation',
    suspended:   'suspension',
    transferred: 'transfer',
    graduated:   'graduation',
    archived:    'archival',
  };
  return map[toStatus] ?? 'status_change';
}

/** Convenience wrappers ─────────────────────────────────────────────── */

export const suspendStudent = (
  studentId: string,
  currentStatus: StudentLifecycleStatus,
  reason: string,
  performedBy?: string
) =>
  transitionStudentStatus({
    studentId,
    fromStatus: currentStatus,
    toStatus: 'suspended',
    reason,
    performedBy,
  });

export const reinstateStudent = (
  studentId: string,
  performedBy?: string
) =>
  transitionStudentStatus({
    studentId,
    fromStatus: 'suspended',
    toStatus: 'active',
    performedBy,
  });

export const graduateStudent = (
  studentId: string,
  performedBy?: string
) =>
  transitionStudentStatus({
    studentId,
    fromStatus: 'active',
    toStatus: 'graduated',
    performedBy,
  });

export const archiveStudent = (
  studentId: string,
  currentStatus: StudentLifecycleStatus,
  reason: string,
  performedBy?: string
) =>
  transitionStudentStatus({
    studentId,
    fromStatus: currentStatus,
    toStatus: 'archived',
    reason,
    performedBy,
  });
