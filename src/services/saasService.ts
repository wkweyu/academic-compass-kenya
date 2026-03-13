import { supabase } from "@/integrations/supabase/client";

export interface SaaSSchool {
  id: number;
  name: string;
  code: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_end: string | null;
  active: boolean;
  created_at: string;
  student_count: number;
  teacher_count: number;
}

export interface SaaSAnalytics {
  total_schools: number;
  active_schools: number;
  inactive_schools: number;
  total_students: number;
  total_teachers: number;
  schools_on_starter: number;
  schools_on_standard: number;
  schools_on_enterprise: number;
}

export interface AuditLog {
  id: number;
  school_id: number | null;
  user_id: string | null;
  action: string;
  module: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
}

export interface SubscriptionStatus {
  is_valid: boolean;
  plan: string;
  status: string;
  days_remaining: number;
  school_name: string;
}

export interface SchoolAdminAccessPayload {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  schoolEmail: string;
  contactPerson?: string;
  adminEmail: string;
  adminPassword: string;
}

export const saasService = {
  async lookupSchoolByCode(code: string) {
    const { data, error } = await supabase.rpc("lookup_school_by_code", { p_code: code });
    if (error) throw error;
    return data?.[0] || null;
  },

  async getAnalytics(): Promise<SaaSAnalytics> {
    const { data, error } = await supabase.rpc("get_saas_analytics");
    if (error) throw error;
    return data?.[0] as SaaSAnalytics;
  },

  async getAllSchools(): Promise<SaaSSchool[]> {
    const { data, error } = await supabase.rpc("get_all_schools");
    if (error) throw error;
    return (data || []) as SaaSSchool[];
  },

  async onboardSchool(params: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    plan?: string;
    contact_person?: string;
    contact_phone?: string;
  }) {
    const { data, error } = await supabase.rpc("onboard_new_school", {
      p_name: params.name,
      p_email: params.email,
      p_phone: params.phone || "",
      p_address: params.address || "",
      p_city: params.city || "",
      p_country: params.country || "Kenya",
      p_plan: params.plan || "starter",
      p_contact_person: params.contact_person || "",
      p_contact_phone: params.contact_phone || "",
    });
    if (error) throw error;
    return data?.[0] as { school_id: number; school_code: string };
  },

  async updateSchoolStatus(schoolId: number, active: boolean) {
    const { error } = await supabase
      .from("schools_school" as any)
      .update({ active } as any)
      .eq("id", schoolId);
    if (error) throw error;
  },

  async updateSubscription(schoolId: number, plan: string, status: string) {
    const { error } = await supabase
      .from("schools_school" as any)
      .update({ subscription_plan: plan, subscription_status: status } as any)
      .eq("id", schoolId);
    if (error) throw error;
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from("audit_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as unknown as AuditLog[];
  },

  async logAudit(action: string, module: string, entityType = "", entityId = "", oldValues = {}, newValues = {}) {
    await supabase.rpc("log_audit_event", {
      p_action: action,
      p_module: module,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_old_values: oldValues,
      p_new_values: newValues,
    });
  },

  async isPlatformAdmin(userId?: string): Promise<boolean> {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      uid = user.id;
    }
    const { data, error } = await supabase.rpc("has_role", { _user_id: uid, _role: "platform_admin" });
    if (error) {
      console.error("isPlatformAdmin RPC error:", error);
      return false;
    }
    return data === true;
  },

  async verifyUserSchool(schoolId: number): Promise<boolean> {
    const { data, error } = await supabase.rpc("verify_user_school", { p_school_id: schoolId });
    if (error) {
      console.error("verifyUserSchool error:", error);
      return false;
    }
    return data === true;
  },

  async checkSubscription(): Promise<SubscriptionStatus | null> {
    const { data, error } = await supabase.rpc("check_subscription_status");
    if (error) {
      console.error("checkSubscription error:", error);
      return null;
    }
    return (data?.[0] as SubscriptionStatus) || null;
  },

  async checkRateLimit(identifier: string): Promise<{ allowed: boolean; attempts_remaining: number; retry_after_seconds: number }> {
    const { data, error } = await supabase.rpc("check_login_rate_limit", { p_identifier: identifier });
    if (error) {
      console.error("checkRateLimit error:", error);
      return { allowed: true, attempts_remaining: 5, retry_after_seconds: 0 };
    }
    return data?.[0] || { allowed: true, attempts_remaining: 5, retry_after_seconds: 0 };
  },

  async recordLoginAttempt(identifier: string, success: boolean) {
    await supabase.rpc("record_login_attempt", { p_identifier: identifier, p_success: success });
  },

  async sendOnboardingNotification(
    schoolId: number, schoolCode: string, schoolName: string, email: string, contactPerson: string,
    adminEmail?: string, adminPassword?: string
  ) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    
    const { data, error } = await supabase.functions.invoke("onboarding-notification", {
      body: {
        school_id: schoolId, school_code: schoolCode, school_name: schoolName,
        email, contact_person: contactPerson,
        admin_email: adminEmail, admin_password: adminPassword,
      },
    });
    if (error) {
      console.error("onboarding-notification invoke error:", error);
      throw error;
    }
    if (data && !data.email_sent) {
      console.error("onboarding-notification failed:", data.email_error);
      throw new Error(data.email_error || "Email sending failed");
    }
    return data;
  },

  async createSchoolAdmin(schoolId: number, adminEmail: string, adminPassword: string) {
    const { data, error } = await supabase.functions.invoke("create-school-admin", {
      body: { school_id: schoolId, admin_email: adminEmail, admin_password: adminPassword },
    });
    if (error) {
      // Extract the actual error message from the response body if available
      const msg = data?.error || error.message || "Unknown error";
      throw new Error(msg);
    }
    return data;
  },

  async provisionSchoolAdminAccess(payload: SchoolAdminAccessPayload) {
    await this.createSchoolAdmin(payload.schoolId, payload.adminEmail, payload.adminPassword);

    await this.sendOnboardingNotification(
      payload.schoolId,
      payload.schoolCode,
      payload.schoolName,
      payload.schoolEmail,
      payload.contactPerson || "",
      payload.adminEmail,
      payload.adminPassword,
    );
  },

  async updateSchoolDetails(schoolId: number, details: {
    name?: string; email?: string; phone?: string; city?: string; country?: string;
  }) {
    const { error } = await supabase
      .from("schools_school" as any)
      .update(details as any)
      .eq("id", schoolId);
    if (error) throw error;
  },
};
