import { supabase } from "@/integrations/supabase/client";

export type AnnouncementScope = "all" | "active" | "trial" | "inactive" | "specific_schools";
export type AnnouncementAudience = "all_users" | "school_admins";
export type AnnouncementChannel = "dashboard" | "email" | "sms" | "dashboard_and_email";
export type AnnouncementSeverity = "info" | "success" | "warning" | "critical";
export type AnnouncementStatus = "draft" | "published" | "archived";

export interface PlatformAnnouncement {
  id: number;
  title: string;
  message: string;
  target_scope: AnnouncementScope;
  target_school_ids: number[] | null;
  audience: AnnouncementAudience;
  delivery_channel: AnnouncementChannel;
  severity: AnnouncementSeverity;
  status: AnnouncementStatus;
  link_url: string | null;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SupportTicketCategory = "support" | "billing" | "training" | "bug" | "feature_request" | "other";
export type SupportTicketPriority = "low" | "medium" | "high" | "urgent";
export type SupportTicketStatus = "open" | "assigned" | "in_progress" | "waiting_on_school" | "resolved" | "closed";

export interface SupportStaffMember {
  user_id: string;
  email: string;
  full_name: string;
  primary_role: string;
  roles: string[];
}

export interface SupportNotification {
  id: number;
  recipient_user_id: string;
  school_id: number | null;
  ticket_id: number | null;
  notification_type: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface SupportImpersonationSession {
  id: number;
  support_user_id: string;
  school_id: number;
  ticket_id: number | null;
  reason: string | null;
  started_at: string;
}

export interface SupportTicket {
  id: number;
  school_id: number;
  created_by: string | null;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  description: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  school?: {
    name?: string;
    code?: string;
  } | null;
}

export interface SupportTicketMessage {
  id: number;
  ticket_id: number;
  sender_user_id: string | null;
  sender_role: "school_user" | "school_admin" | "platform_staff" | "system";
  message: string;
  is_internal: boolean;
  created_at: string;
}

function normalizeTicket(record: any): SupportTicket {
  const relation = Array.isArray(record?.schools_school)
    ? record.schools_school[0]
    : record?.schools_school;

  return {
    ...record,
    school: relation
      ? {
          name: relation.name,
          code: relation.code,
        }
      : null,
  } as SupportTicket;
}

export const communicationHubService = {
  async getPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
    const { data, error } = await supabase
      .from("platform_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as PlatformAnnouncement[];
  },

  async getActiveAnnouncements(): Promise<PlatformAnnouncement[]> {
    const { data, error } = await supabase.rpc("get_active_platform_announcements");
    if (error) throw error;
    return (data || []) as PlatformAnnouncement[];
  },

  async createAnnouncement(payload: {
    title: string;
    message: string;
    target_scope?: AnnouncementScope;
    target_school_ids?: number[];
    audience?: AnnouncementAudience;
    delivery_channel?: AnnouncementChannel;
    severity?: AnnouncementSeverity;
    status?: AnnouncementStatus;
    link_url?: string;
    starts_at?: string | null;
    expires_at?: string | null;
  }): Promise<PlatformAnnouncement> {
    const { data, error } = await supabase
      .from("platform_announcements")
      .insert({
        title: payload.title,
        message: payload.message,
        target_scope: payload.target_scope || "all",
        target_school_ids: payload.target_school_ids || [],
        audience: payload.audience || "all_users",
        delivery_channel: payload.delivery_channel || "dashboard",
        severity: payload.severity || "info",
        status: payload.status || "draft",
        link_url: payload.link_url || null,
        starts_at: payload.starts_at || new Date().toISOString(),
        expires_at: payload.expires_at || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as PlatformAnnouncement;
  },

  async updateAnnouncement(
    announcementId: number,
    updates: Partial<Omit<PlatformAnnouncement, "id" | "created_at" | "created_by">>,
  ): Promise<void> {
    const { error } = await supabase
      .from("platform_announcements")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcementId);

    if (error) throw error;
  },

  async getSupportTickets(scope: "school" | "platform" = "school"): Promise<SupportTicket[]> {
    let query = supabase
      .from("support_tickets")
      .select("*, schools_school(name, code)")
      .order("updated_at", { ascending: false });

    if (scope === "school") {
      const { data: schoolId, error: schoolError } = await supabase.rpc("get_user_school_id");
      if (schoolError) throw schoolError;
      if (schoolId) {
        query = query.eq("school_id", schoolId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeTicket);
  },

  async createSupportTicket(payload: {
    subject: string;
    description: string;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
  }): Promise<number> {
    const { data, error } = await supabase.rpc("create_support_ticket", {
      p_subject: payload.subject,
      p_description: payload.description,
      p_category: payload.category || "support",
      p_priority: payload.priority || "medium",
    });

    if (error) throw error;
    return Number(data);
  },

  async updateSupportTicket(
    ticketId: number,
    updates: Partial<Pick<SupportTicket, "status" | "assigned_to" | "resolution_notes">>,
  ): Promise<void> {
    if (updates.assigned_to) {
      await this.assignSupportTicket(ticketId, updates.assigned_to);
      return;
    }

    if (updates.status === "resolved" || updates.status === "closed") {
      await this.resolveSupportTicket(ticketId, updates.resolution_notes || "Resolved by support", updates.status === "closed");
      return;
    }

    if (updates.status) {
      await this.updateSupportTicketStatus(ticketId, updates.status, updates.resolution_notes);
      return;
    }

    throw new Error("No supported ticket updates were provided");
  },

  async listSupportStaff(): Promise<SupportStaffMember[]> {
    const { data, error } = await supabase.rpc("list_support_staff");
    if (error) throw error;
    return (data || []) as SupportStaffMember[];
  },

  async assignSupportTicket(ticketId: number, assignedTo: string, note?: string): Promise<void> {
    const { error } = await supabase.rpc("assign_support_ticket", {
      p_ticket_id: ticketId,
      p_assigned_to: assignedTo,
      p_note: note || null,
    });

    if (error) throw error;
  },

  async updateSupportTicketStatus(ticketId: number, status: SupportTicketStatus, resolutionNotes?: string): Promise<void> {
    const { error } = await supabase.rpc("update_support_ticket_status", {
      p_ticket_id: ticketId,
      p_status: status,
      p_resolution_notes: resolutionNotes || null,
    });

    if (error) throw error;
  },

  async resolveSupportTicket(ticketId: number, resolutionNotes: string, closeTicket = false): Promise<void> {
    const { error } = await supabase.rpc("resolve_support_ticket", {
      p_ticket_id: ticketId,
      p_resolution_notes: resolutionNotes,
      p_close_ticket: closeTicket,
    });

    if (error) throw error;
  },

  async getSupportTicketMessages(ticketId: number): Promise<SupportTicketMessage[]> {
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []) as SupportTicketMessage[];
  },

  async addSupportTicketMessage(ticketId: number, message: string, isInternal = false): Promise<number> {
    const { data, error } = await supabase.rpc("add_support_ticket_message", {
      p_ticket_id: ticketId,
      p_message: message,
      p_is_internal: isInternal,
    });

    if (error) throw error;
    return Number(data);
  },

  async getSupportNotifications(): Promise<SupportNotification[]> {
    const { data, error } = await supabase
      .from("support_notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as SupportNotification[];
  },

  async startSupportImpersonation(schoolId: number, ticketId?: number | null, reason?: string): Promise<number> {
    const { data, error } = await supabase.rpc("start_support_impersonation", {
      p_school_id: schoolId,
      p_ticket_id: ticketId || null,
      p_reason: reason || null,
    });

    if (error) throw error;
    return Number(data);
  },

  async endSupportImpersonation(sessionId?: number | null): Promise<number> {
    const { data, error } = await supabase.rpc("end_support_impersonation", {
      p_session_id: sessionId || null,
    });

    if (error) throw error;
    return Number(data);
  },

  async getCurrentSupportImpersonation(): Promise<SupportImpersonationSession | null> {
    const { data, error } = await supabase.rpc("get_current_support_impersonation");
    if (error) throw error;
    return (data?.[0] as SupportImpersonationSession) || null;
  },

  async runSupportDiagnostics(schoolId?: number | null): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc("run_support_school_diagnostics", {
      p_school_id: schoolId || null,
    });

    if (error) throw error;
    return (data || {}) as Record<string, unknown>;
  },
};
