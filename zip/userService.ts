import { api } from "@/api/api";

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  school?: {
    id: number;
    name: string;
  } | null;
  entity_type?: string;
  entity_id?: number | null;
  linked_entity_name?: string | null;
  status: 'INVITED' | 'PENDING_EMAIL_VERIFICATION' | 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'EXPIRED';
  login_enabled: boolean;
  expires_at?: string | null;
  last_login?: string | null;
}

export interface EnableLoginPayload {
  entity_type: string;
  entity_id: number;
  email: string;
  role?: string;
  send_invite?: boolean;
  login_enabled?: boolean;
  expires_at?: string | null;
  password?: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  description: string;
  created_at: string;
  metadata: any;
  actor_name?: string;
}

export const userService = {
  async getUsers(filters?: { role?: string }): Promise<UserProfile[]> {
    const response = await api.get<UserProfile[]>("/api/users/", filters);
    return response.data || [];
  },

  async enableLogin(payload: EnableLoginPayload): Promise<UserProfile> {
    const response = await api.post<UserProfile>("/api/users/enable-login/", payload);
    return response.data;
  },

  async deleteUser(userId: number): Promise<void> {
    await api.delete(`/api/users/${userId}/`);
  },

  async getCurrentUser(): Promise<UserProfile> {
    const response = await api.get<UserProfile>("/api/users/me/");
    return response.data;
  },

  async getUserHistory(userId: number): Promise<ActivityLog[]> {
    const response = await api.get<ActivityLog[]>(`/api/schools/activity-logs/`, { actor_id: userId });
    return response.data || [];
  }
};
