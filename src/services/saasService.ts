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

  async isPlatformAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "platform_admin" });
    return !!data;
  },
};
