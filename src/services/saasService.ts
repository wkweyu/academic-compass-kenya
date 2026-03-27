import { supabase } from "@/integrations/supabase/client";
import { api } from "@/api/api";

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
  portfolio_owner_user_id: string | null;
  portfolio_owner_name: string;
  portfolio_owner_email: string;
  portfolio_owner_role: string;
}

export interface SaasInvoice {
  id: number;
  school_id: number;
  invoice_number: string;
  amount: number;
  status: string;
  invoice_type?: string;
  due_date: string;
  paid_at: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  balance_due?: number | null;
  collection_stage?: string | null;
  items: any[];
  created_at: string;
  updated_at: string;
}

export interface BillingAccountSnapshot {
  billing_account_id: number;
  school_id: number;
  school_name: string;
  account_status: string;
  collection_status: string;
  billing_email: string | null;
  currency: string;
  country: string;
  billing_subscription_id: number | null;
  current_plan: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
  term_start: string | null;
  term_end: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  open_invoice_count: number;
  overdue_invoice_count: number;
  outstanding_balance: number;
  last_invoice_id: number | null;
  last_invoice_status: string | null;
  next_follow_up_at: string | null;
}

export interface BillingPaymentResult {
  payment_id: number;
  invoice_status: string;
  balance_due: number;
  subscription_status: string;
  account_status: string;
  term_end: string | null;
}

export interface BillingEvent {
  id: number;
  billing_account_id: number | null;
  billing_subscription_id: number | null;
  school_id: number | null;
  invoice_id: number | null;
  payment_id: number | null;
  event_type: string;
  event_payload: any;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface SaasTierFeature {
  tier_name: string;
  onboarding_fee: number;
  annual_fee: number;
  max_students: number;
  max_users: number;
  modules: string[];
}

export interface SaasCommunication {
  id: number;
  school_id: number | null;
  recipient_email: string | null;
  subject: string | null;
  content: string | null;
  type: string;
  category: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SubscriptionHistory {
  id: number;
  plan_name: string;
  status: string;
  amount: number;
  start_date: string;
  end_date: string;
  created_at: string;
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

export interface PlatformAccessProfile {
  user_id: string;
  roles: string[];
  primary_role: string;
  scope: string;
  can_view_dashboard: boolean;
  can_onboard_schools: boolean;
  can_manage_school_status: boolean;
  can_manage_subscriptions: boolean;
  can_manage_portfolios: boolean;
  can_edit_school_details: boolean;
  can_resend_admin_access: boolean;
  can_view_audit_logs: boolean;
  accessible_school_count: number;
}

export interface PlatformStaffMember {
  user_id: string;
  email: string;
  full_name: string;
  primary_role: string;
  roles: string[];
}

export interface PlatformManagedUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
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

export interface InitializeSchoolOnboardingResponse {
  school: SaaSSchool;
  lead: {
    id: number;
    stage: string;
    priority: string;
    source: string;
    school: number;
  };
  lead_created: boolean;
  onboarding_progress: {
    current_step: string;
    percentage_complete: number;
    school_id: number;
  };
}

export interface TransactionalOnboardSchoolResponse extends InitializeSchoolOnboardingResponse {
  success: boolean;
  school_id: number;
  school_code: string;
  portfolio_assigned: boolean;
  subscription_created: boolean;
  subscription_plan: string;
}

export const saasService = {
  async repairPlatformLinks(): Promise<void> {
    try {
      await api.post<{ success: boolean }>("/api/users/repair-platform-links/", {});
    } catch (e) {
      console.warn("repairPlatformLinks failed (non-blocking):", e);
    }
  },

  async getAccessProfile(): Promise<PlatformAccessProfile | null> {
    const { data, error } = await supabase.rpc("get_platform_access_profile");
    if (error) {
      const message = String(error.message || "").toLowerCase();
      const details = String((error as { details?: string })?.details || "").toLowerCase();
      const isMissingProfileRpc =
        message.includes("get_platform_access_profile") ||
        details.includes("get_platform_access_profile") ||
        message.includes("schema cache") ||
        details.includes("schema cache");

      if (!isMissingProfileRpc) {
        throw error;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        return null;
      }

      const isAdmin = await this.isPlatformAdmin(userId);
      if (!isAdmin) {
        return null;
      }

      return {
        user_id: userId,
        roles: ["platform_admin"],
        primary_role: "platform_admin",
        scope: "global",
        can_view_dashboard: true,
        can_onboard_schools: true,
        can_manage_school_status: true,
        can_manage_subscriptions: true,
        can_manage_portfolios: true,
        can_edit_school_details: true,
        can_resend_admin_access: true,
        can_view_audit_logs: true,
        accessible_school_count: 0,
      };
    }
    return (data?.[0] as PlatformAccessProfile) || null;
  },

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
    const { data, error } = await supabase.rpc("get_all_schools_with_portfolios");
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
    try {
      await this.repairPlatformLinks();
      const payload = {
        name: params.name,
        email: params.email,
        phone: params.phone || "",
        address: params.address || "",
        city: params.city || "",
        country: params.country || "Kenya",
        plan: params.plan || "starter",
        contact_person: params.contact_person || "",
        contact_phone: params.contact_phone || "",
        source: "saas_dashboard",
        priority: "MEDIUM",
      };
      const response = await api.post<TransactionalOnboardSchoolResponse>("/api/schools/onboard/", {
        ...payload,
      });
      return response.data;
    } catch (error: any) {
      const detail = error?.response?.data?.error;
      const message =
        typeof detail === "string"
          ? detail
          : detail && typeof detail === "object"
            ? Object.values(detail).flat().join(" ")
            : error?.message || "Failed to onboard school";
      throw new Error(message);
    }
  },

  async initializeSchoolOnboarding(schoolId: number, payload?: { source?: string; priority?: string }) {
    const response = await api.post<InitializeSchoolOnboardingResponse>(
      `/api/schools/${schoolId}/initialize-onboarding/`,
      {
        source: payload?.source || "saas_dashboard",
        priority: payload?.priority || "MEDIUM",
      },
    );
    return response.data;
  },

  async updateSchoolStatus(schoolId: number, active: boolean) {
    const { error } = await supabase.rpc("update_saas_school_status", {
      p_school_id: schoolId,
      p_active: active,
    });
    if (error) throw error;
  },

  async updateSubscription(schoolId: number, plan: string, status: string) {
    const { error } = await supabase.rpc("update_saas_subscription", {
      p_school_id: schoolId,
      p_plan: plan,
      p_status: status,
    });
    if (error) throw error;
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase.rpc("get_saas_audit_logs", { p_limit: limit });
    if (error) throw error;
    return (data || []) as unknown as AuditLog[];
  },

  async getTierFeatures(): Promise<SaasTierFeature[]> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("name, yearly_price, max_students, max_users, features")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw error;

    return (data || []).map((plan: any) => ({
      tier_name: plan.name,
      onboarding_fee: 0,
      annual_fee: Number(plan.yearly_price || 0),
      max_students: Number(plan.max_students || 0),
      max_users: Number(plan.max_users || 0),
      modules: Array.isArray(plan.features) ? plan.features : [],
    }));
  },

  async getBillingEvents(schoolId: number, limit = 12): Promise<BillingEvent[]> {
    const { data, error } = await supabase
      .from("billing_events")
      .select("*")
      .eq("school_id", schoolId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as BillingEvent[];
  },

  async getDueSubscriptions(daysAhead = 14) {
    const { data, error } = await supabase.rpc("get_due_subscriptions", {
      p_days_ahead: daysAhead,
    });
    if (error) throw error;
    return data as Array<{
      school_id: number;
      school_name: string;
      subscription_plan: string;
      subscription_status: string;
      subscription_end: string | null;
      days_left: number | null;
      invoice_id: number | null;
      invoice_status: string | null;
      invoice_due_date: string | null;
    }>;
  },

  async getBillingAccountSnapshot(schoolId: number): Promise<BillingAccountSnapshot | null> {
    const { data, error } = await supabase.rpc("get_billing_account_snapshot", {
      p_school_id: schoolId,
    });
    if (error) throw error;
    return (data?.[0] as BillingAccountSnapshot) || null;
  },

  async initializeSchoolBilling(params: {
    schoolId: number;
    planName?: string;
    trialDays?: number;
    invoiceStrategy?: "trial_only" | "onboarding_only" | "term_only" | "onboarding_and_term";
    onboardingFee?: number;
    termFee?: number;
    reason?: string;
  }) {
    const { data, error } = await supabase.rpc("initialize_school_billing", {
      p_school_id: params.schoolId,
      p_plan_name: params.planName || null,
      p_trial_days: params.trialDays || null,
      p_invoice_strategy: params.invoiceStrategy || "trial_only",
      p_onboarding_fee: params.onboardingFee || null,
      p_term_fee: params.termFee || null,
      p_reason: params.reason || null,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  async issueBillingInvoice(params: {
    schoolId: number;
    invoiceType?: "onboarding" | "subscription" | "subscription_renewal" | "adjustment" | "manual";
    amount?: number;
    dueDate?: string;
    description?: string;
    periodStart?: string;
    periodEnd?: string;
    metadata?: any;
  }) {
    const { data, error } = await supabase.rpc("issue_billing_invoice", {
      p_school_id: params.schoolId,
      p_invoice_type: params.invoiceType || "manual",
      p_amount: params.amount ?? null,
      p_due_date: params.dueDate || null,
      p_description: params.description || null,
      p_period_start: params.periodStart || null,
      p_period_end: params.periodEnd || null,
      p_metadata: params.metadata || {},
    });
    if (error) throw error;
    return data as number;
  },

  async postBillingPayment(params: {
    invoiceId: number;
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
  }): Promise<BillingPaymentResult | null> {
    const { data, error } = await supabase.rpc("post_billing_payment", {
      p_invoice_id: params.invoiceId,
      p_amount: params.amount ?? null,
      p_payment_method: params.method || "Manual",
      p_reference: params.reference || null,
      p_notes: params.notes || null,
    });
    if (error) throw error;
    return (data?.[0] as BillingPaymentResult) || null;
  },

  async extendBillingTrial(params: { schoolId: number; newEndDate: string; reason?: string }) {
    const { error } = await supabase.rpc("extend_billing_trial", {
      p_school_id: params.schoolId,
      p_new_end_date: params.newEndDate,
      p_reason: params.reason || null,
    });
    if (error) throw error;
  },

  async adjustBillingSubscriptionTerm(params: { schoolId: number; newEndDate: string; newStatus?: string; reason?: string }) {
    const { error } = await supabase.rpc("adjust_billing_subscription_term", {
      p_school_id: params.schoolId,
      p_new_end_date: params.newEndDate,
      p_new_status: params.newStatus || null,
      p_reason: params.reason || null,
    });
    if (error) throw error;
  },

  async extendSubscriptionPeriod(params: { schoolId: number; newEndDate: string; newStatus?: string; reason?: string }) {
    await this.adjustBillingSubscriptionTerm(params);
  },

  async extendTrial(params: { schoolId: number; newEndDate: string; reason?: string }) {
    await this.extendBillingTrial(params);
  },

  async generateInvoice(params: {
    schoolId: number;
    amount: number;
    dueDate: string;
    items: any[];
    periodStart?: string;
    periodEnd?: string;
  }) {
    const data = await this.issueBillingInvoice({
      schoolId: params.schoolId,
      invoiceType: "manual",
      amount: params.amount,
      dueDate: params.dueDate,
      description: params.items?.[0]?.description || "Manual invoice",
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      metadata: { items: params.items || [] },
    });
    return data as number;
  },

  async getInvoices(schoolId?: number): Promise<SaasInvoice[]> {
    let query = supabase.from("saas_invoices").select("*");
    if (schoolId) query = query.eq("school_id", schoolId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data as SaasInvoice[];
  },

  async getSubscriptionHistory(schoolId: number): Promise<SubscriptionHistory[]> {
    const { data, error } = await supabase.rpc("get_school_subscription_history", {
      p_school_id: schoolId,
    });
    if (error) throw error;
    return data as SubscriptionHistory[];
  },

  async getCommunications(schoolId?: number): Promise<SaasCommunication[]> {
    let query = supabase.from("saas_communications").select("*");
    if (schoolId) query = query.eq("school_id", schoolId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data as SaasCommunication[];
  },

  async logCommunication(params: {
    schoolId: number;
    recipient: string;
    subject: string;
    content: string;
    category: "billing" | "marketing" | "support" | "update";
    type?: "email" | "sms" | "system_notification";
  }) {
    const { error } = await supabase.rpc("log_saas_communication", {
      p_school_id: params.schoolId,
      p_recipient: params.recipient,
      p_subject: params.subject,
      p_content: params.content,
      p_category: params.category,
      p_type: params.type || "email",
    });
    if (error) throw error;
  },

  async getExpiringSubscriptions() {
    const { data, error } = await supabase.rpc("check_expiring_subscriptions");
    if (error) throw error;
    return data as { school_id: number; school_name: string; end_date: string; days_left: number }[];
  },

  async processOverdueInvoices(): Promise<number> {
    const { data, error } = await supabase.rpc("process_overdue_invoices");
    if (error) throw error;
    return data as number;
  },

  async autoGenerateRenewalInvoices(): Promise<{ school_id: number; invoice_id: number; amount: number }[]> {
    const { data, error } = await supabase.rpc("auto_generate_renewal_invoices");
    if (error) throw error;
    return (data || []) as any[];
  },

  async recordInvoicePayment(params: { invoiceId: number; method?: string; reference?: string }): Promise<void> {
    await this.postBillingPayment({
      invoiceId: params.invoiceId,
      method: params.method,
      reference: params.reference,
    });
  },

  async deleteSchool(schoolId: number): Promise<void> {
    await api.delete(`/api/schools/${schoolId}/delete/`);
  },

  async sendInvoiceNotification(invoiceId: number): Promise<void> {
    const { data: inv } = await supabase.from("saas_invoices").select("school_id").eq("id", invoiceId).single();
    if (!inv) throw new Error("Invoice not found");
    
    const { error } = await supabase.rpc("send_billing_notification", {
      p_school_id: inv.school_id,
      p_invoice_id: invoiceId,
      p_subject: "Invoice Notification",
      p_message_body: "A new billing invoice has been generated for your school."
    });
    if (error) throw error;
  },

  async processBillingJobs(): Promise<{ renewalSent: number; overdueReminded: number }> {
    const { data: renewalSent, error: rError } = await supabase.rpc("send_pending_renewal_notifications");
    const { data: overdueReminded, error: oError } = await supabase.rpc("send_overdue_reminders");
    if (rError) throw rError;
    if (oError) throw oError;
    return { 
      renewalSent: renewalSent || 0, 
      overdueReminded: overdueReminded || 0 
    };
  },

  async listPlatformStaff(): Promise<PlatformStaffMember[]> {
    await this.repairPlatformLinks();
    const { data, error } = await supabase.rpc("list_platform_staff");
    if (error) throw error;
    return (data || []) as PlatformStaffMember[];
  },

  async listManagedUsers(): Promise<PlatformManagedUser[]> {
    const response = await api.get<PlatformManagedUser[]>("/api/users/");
    return response.data || [];
  },

  async createManagedUser(payload: {
    email: string;
    first_name?: string;
    last_name?: string;
    role: string;
    password?: string;
  }): Promise<PlatformManagedUser> {
    const { data, error } = await supabase.functions.invoke("create-platform-user", {
      body: payload,
    });
    if (error) {
      throw new Error(data?.error || error.message || "Failed to create user");
    }
    return data?.user as PlatformManagedUser;
  },

  async deleteManagedUser(userId: number): Promise<void> {
    const { data, error } = await supabase.functions.invoke("delete-platform-user", {
      body: { user_id: userId },
    });
    if (error) {
      throw new Error(data?.error || error.message || "Failed to delete user");
    }
  },

  async updateSchoolPortfolioOwner(schoolId: number, ownerUserId: string | null): Promise<void> {
    await this.repairPlatformLinks();
    const { error } = await supabase.rpc("assign_school_portfolio", {
      p_school_id: schoolId,
      p_owner_user_id: ownerUserId,
      p_notes: "",
    });
    if (error) throw error;
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

  async hasPlatformConsoleAccess(): Promise<boolean> {
    const profile = await this.getAccessProfile();
    return profile?.can_view_dashboard === true;
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
    const { error } = await supabase.rpc("update_saas_school_details", {
      p_school_id: schoolId,
      p_name: details.name,
      p_email: details.email,
      p_phone: details.phone,
      p_city: details.city,
      p_country: details.country,
    });
    if (error) throw error;
  },

  async assignSchoolPortfolio(schoolId: number, ownerUserId: string | null, notes = "") {
    const { error } = await supabase.rpc("assign_school_portfolio", {
      p_school_id: schoolId,
      p_owner_user_id: ownerUserId,
      p_notes: notes,
    });
    if (error) throw error;
  },
};
