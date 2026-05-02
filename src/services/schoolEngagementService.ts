import { api } from "@/api/api";

export interface SchoolCommunicationLog {
  id: number;
  school: number;
  lead: number | null;
  onboarding_progress: number | null;
  task: number | null;
  opportunity: number | null;
  created_by: number | null;
  communication_type: "EMAIL" | "CALL" | "MEETING" | "NOTE" | "TASK";
  direction: "OUTBOUND" | "INBOUND" | "INTERNAL";
  participants: Array<{ name?: string; role?: string; email?: string; phone?: string }>;
  subject: string;
  content: string;
  attachments: Array<{ name?: string; url?: string }>;
  occurred_at: string;
  follow_up_required: boolean;
  follow_up_due_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchoolNotificationTemplate {
  id: number;
  key: string;
  name: string;
  subject_template: string;
  body_template: string;
  channels: string[];
  schedule_type: string;
  variables: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolNotificationRecord {
  id: number;
  school: number;
  recipient: number | null;
  template: number | null;
  template_key: string;
  channel: "IN_APP" | "EMAIL" | "SMS";
  subject: string;
  body: string;
  status: "PENDING" | "SCHEDULED" | "SENT" | "FAILED" | "READ";
  scheduled_for: string | null;
  sent_at: string | null;
  read_at: string | null;
  opened_at: string | null;
  error_message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchoolFollowUp {
  id: number;
  school: number;
  lead: number | null;
  onboarding_progress: number | null;
  task: number | null;
  opportunity: number | null;
  assigned_to: number | null;
  created_by: number | null;
  completed_by: number | null;
  escalated_to: number | null;
  communication_log: number | null;
  title: string;
  description: string;
  follow_up_type: "QUICK_CALL" | "DATA_REVIEW" | "RENEWAL" | "BUSINESS_REVIEW" | "REENGAGEMENT" | "CUSTOM";
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  status: "PENDING" | "SNOOZED" | "COMPLETE" | "OVERDUE" | "CANCELED";
  due_at: string;
  snoozed_until: string | null;
  completed_at: string | null;
  escalated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreview {
  template_key: string;
  name: string;
  subject: string;
  body: string;
  channels: string[];
  schedule_type: string;
}

export const schoolEngagementService = {
  async getCommunications(schoolId: number, search?: string) {
    const response = await api.get<SchoolCommunicationLog[]>("/api/schools/communications/", {
      school_id: schoolId,
      search,
    });
    return response.data;
  },

  async createCommunication(payload: {
    school_id: number;
    communication_type: string;
    direction: string;
    subject?: string;
    content: string;
    participants?: Array<{ name?: string; role?: string; email?: string; phone?: string }>;
    follow_up_required?: boolean;
    follow_up_due_at?: string;
    follow_up_title?: string;
  }) {
    const response = await api.post<{ communication: SchoolCommunicationLog; follow_up: SchoolFollowUp | null }>(
      "/api/schools/communications/",
      payload,
    );
    return response.data;
  },

  async getNotificationTemplates() {
    const response = await api.get<SchoolNotificationTemplate[]>("/api/schools/notifications/templates/");
    return response.data;
  },

  async previewNotification(template_key: string, variables: Record<string, unknown>) {
    const response = await api.post<NotificationPreview>("/api/schools/notifications/preview/", {
      template_key,
      variables,
    });
    return response.data;
  },

  async getNotifications(schoolId: number, unreadOnly = false) {
    const response = await api.get<SchoolNotificationRecord[]>("/api/schools/notifications/", {
      school_id: schoolId,
      unread_only: unreadOnly,
    });
    return response.data;
  },

  async sendNotification(payload: {
    school_id: number;
    recipient_id: number;
    template_key: string;
    variables?: Record<string, unknown>;
    channels?: string[];
    subject_override?: string;
    body_override?: string;
  }) {
    const response = await api.post<SchoolNotificationRecord[]>("/api/schools/notifications/send/", payload);
    return response.data;
  },

  async getFollowUps(schoolId: number, params?: { due_today?: boolean; overdue?: boolean; status?: string }) {
    const response = await api.get<SchoolFollowUp[]>("/api/schools/follow-ups/", {
      school_id: schoolId,
      ...params,
    });
    return response.data;
  },

  async getTodayFollowUps() {
    const response = await api.get<SchoolFollowUp[]>("/api/schools/follow-ups/today/");
    return response.data;
  },

  async createFollowUp(payload: {
    school_id: number;
    title: string;
    description?: string;
    due_at: string;
    follow_up_type?: string;
    recurrence?: string;
  }) {
    const response = await api.post<SchoolFollowUp>("/api/schools/follow-ups/", payload);
    return response.data;
  },

  async snoozeFollowUp(followUpId: number, days: number) {
    const response = await api.post<SchoolFollowUp>(`/api/schools/follow-ups/${followUpId}/snooze/`, { days });
    return response.data;
  },

  async completeFollowUp(followUpId: number, notes?: string) {
    const response = await api.post<SchoolFollowUp>(`/api/schools/follow-ups/${followUpId}/complete/`, { notes });
    return response.data;
  },
};
