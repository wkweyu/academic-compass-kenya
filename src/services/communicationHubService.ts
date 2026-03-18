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
export type SupportTicketStatus = "open" | "in_progress" | "waiting_on_school" | "resolved" | "closed";

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
  sender_role: "school_admin" | "platform_staff" | "system";
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
    const { error } = await supabase
      .from("support_tickets")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

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
};
