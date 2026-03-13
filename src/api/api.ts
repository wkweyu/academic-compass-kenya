import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // Required for session authentication
});

// Function to get CSRF token
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

// Attach authentication to every request
axiosInstance.interceptors.request.use(
  (config) => {
    // Try token authentication first
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }

    // Add CSRF token for all non-GET requests (required for session auth)
    if (config.method !== "get" && config.method !== "GET") {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers["X-CSRFToken"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      console.error('API Error:', error.response?.status, error.response?.data);
    }
    
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("authToken");
      // Only redirect if not already on auth page
      if (window.location.pathname !== '/auth') {
        window.location.href = "/auth";
      }
    }
    
    return Promise.reject(error);
  }
);

// Generic API methods
export const api = {
  get: <T>(url: string, params?: object) =>
    axiosInstance.get<T>(url, { params }),
  post: <T>(url: string, data?: object) => axiosInstance.post<T>(url, data),
  put: <T>(url: string, data: object) => axiosInstance.put<T>(url, data),
  patch: <T>(url: string, data: object) => axiosInstance.patch<T>(url, data),
  delete: <T>(url: string) => axiosInstance.delete<T>(url),
};

// Auth API
interface ApiResponse {
  key?: string; // dj-rest-auth returns "key" for login
  token?: string; // token auth returns "token"
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

    throw new Error("No token received");
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("Login error:", err.message);
    }
    throw new Error(
      err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.error ||
        "Login failed: check email and password"
    );
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUserProfile> {
  try {
    // Try the correct Django user endpoint
    const response = await api.get<AuthenticatedUserProfile>("/api/users/me/");
    return response.data;
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("User fetch error:", err.message);
    }
    throw new Error("Failed to fetch user");
  }
}

export async function signOut() {
  try {
    await api.post("/api/auth/logout/");
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("Logout error:", err.message);
    }
  } finally {
    localStorage.removeItem("authToken");
  }
}

export async function signUp(
  email: string,
  password: string,
  password2: string
) {
  try {
    const response = await api.post<ApiResponse>("/api/auth/registration/", {
      email,
      password1: password,
      password2: password2,
    });

    if (response.data.key) {
      localStorage.setItem("authToken", response.data.key);
    }

    return response.data;
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("Registration error:", err.message);
    }
    throw new Error(
      err.response?.data?.email?.[0] ||
        err.response?.data?.password1?.[0] ||
        "Registration failed"
    );
  }
}

// Auth headers helper for backwards compatibility
export function authHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Token ${token}` } : {};
}

// Test API connection
export async function testConnection() {
  try {
    const response = await api.get("/");
    return response.status === 200;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("API connection test failed:", error);
    }
    return false;
  }
}
