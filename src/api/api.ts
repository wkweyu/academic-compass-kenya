import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the backend API URL based on environment and current hostname.
 * Ensures consistent handling for local development and Render deployments.
 */
export function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const { origin, hostname, protocol } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) {
    return 'http://localhost:8000';
  }

  // Handle Render dual-service deployment pattern
  if (hostname.endsWith('.onrender.com')) {
    if (hostname.includes('-web')) {
      const apiHostname = hostname.replace(/-web(?=\.onrender\.com$)/, '-api');
      return `${protocol}//${apiHostname}`;
    }
    if (hostname.includes('-api')) {
      return origin;
    }
  }

  return origin;
}

const BASE_URL = resolveApiBaseUrl();
const API_ROOT = `${BASE_URL}/api`;

// Axios instance for backend communication
const axiosInstance = axios.create({
  baseURL: API_ROOT,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Function to get CSRF token from cookies
function getCSRFToken() {
  const name = "csrftoken=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

// Request interceptor to attach authentication
axiosInstance.interceptors.request.use(
  async (config) => {
    // 1. Django Token Auth (Priority for system-level actions)
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    } else {
      // 2. Supabase JWT Auth (Session-based)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }

    // 3. CSRF Protection for state-changing requests
    if (!["get", "GET", "head", "HEAD", "options", "OPTIONS"].includes(config.method || "")) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers["X-CSRFToken"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error handling and redirects
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (import.meta.env.DEV) {
      console.error('API Error:', error.response?.status, error.response?.data);
    }
    
    if (error.response?.status === 401) {
      // Clear expired tokens and redirect to login if not already there
      localStorage.removeItem("authToken");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !window.location.pathname.startsWith('/auth') && !window.location.pathname.startsWith('/saas/login')) {
        window.location.href = "/auth";
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Core API utility for making requests to the Django backend.
 * Base URL is automatically set to /api
 */
export const api = {
  get: <T>(url: string, params?: object) => {
    const cleanUrl = url.startsWith('/api/') ? url.replace('/api/', '/') : url;
    return axiosInstance.get<T>(cleanUrl, { params });
  },
  post: <T>(url: string, data?: object) => {
    // Specialized handling for root paths like /api-token-auth/
    if (url.startsWith('/api-token-auth/')) {
        return axios.create({ baseURL: resolveApiBaseUrl() }).post<T>(url, data);
    }
    const cleanUrl = url.startsWith('/api/') ? url.replace('/api/', '/') : url;
    return axiosInstance.post<T>(cleanUrl, data);
  },
  put: <T>(url: string, data: object) => {
    const cleanUrl = url.startsWith('/api/') ? url.replace('/api/', '/') : url;
    return axiosInstance.put<T>(cleanUrl, data);
  },
  patch: <T>(url: string, data: object) => {
    const cleanUrl = url.startsWith('/api/') ? url.replace('/api/', '/') : url;
    return axiosInstance.patch<T>(cleanUrl, data);
  },
  delete: <T>(url: string) => {
    const cleanUrl = url.startsWith('/api/') ? url.replace('/api/', '/') : url;
    return axiosInstance.delete<T>(cleanUrl);
  },
};

// --- Authentication API Helpers ---

interface ApiResponse {
  key?: string;
  token?: string;
  [key: string]: any;
}

export interface AuthenticatedUserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  school: {
    id: number;
    name: string;
  } | null;
}

export async function signIn(email: string, password: string) {
  try {
    const response = await api.post<ApiResponse>("/api-token-auth/", {
      username: email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      return response.data;
    }
    throw new Error("No token received from server");
  } catch (err: any) {
    throw new Error(
      err.response?.data?.non_field_errors?.[0] ||
      err.response?.data?.error ||
      "Login failed: please check your credentials"
    );
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUserProfile> {
  // Use /api/users/me/
  const response = await api.get<AuthenticatedUserProfile>("/users/me/");
  return response.data;
}

export async function signOut() {
  try {
    await api.post("/auth/logout/");
  } catch (err) {
    console.warn("Logout request failed, clearing local session anyway.");
  } finally {
    localStorage.removeItem("authToken");
    await supabase.auth.signOut();
  }
}

export async function signUp(email: string, password: string, password2: string) {
  try {
    const response = await api.post("/auth/registration/", {
      email,
      password1: password,
      password2: password2,
    });

    if (response.data.key) {
      localStorage.setItem("authToken", response.data.key);
    }
    return response.data;
  } catch (err: any) {
    throw new Error(
      err.response?.data?.email?.[0] ||
      err.response?.data?.password1?.[0] ||
      "Registration failed"
    );
  }
}

export function authHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Token ${token}` } : {};
}

export async function testConnection() {
  try {
    const response = await axiosInstance.get("/health/");
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
