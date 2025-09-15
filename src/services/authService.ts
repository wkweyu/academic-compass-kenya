// Authentication service for debugging and testing
import { api } from "@/api/api";

export const authService = {
  // Test if we can authenticate
  async testAuth(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await api.get("/api/auth/user/");
      return { success: true, user: response.data };
    } catch (error: any) {
      console.error('Auth test failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message || 'Authentication failed' 
      };
    }
  },

  // Get current token
  getToken(): string | null {
    return localStorage.getItem('authToken');
  },

  // Set token manually (for debugging)
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
  },

  // Clear token
  clearToken(): void {
    localStorage.removeItem('authToken');
  },

  // Get user info
  async getCurrentUser() {
    try {
      const response = await api.get("/api/auth/user/");
      return response.data;
    } catch (error) {
      console.error('Failed to get current user:', error);
      throw error;
    }
  }
};