import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

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
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("authToken");
      window.location.href = "/login";
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

export async function signIn(email: string, password: string) {
  try {
    // Try token authentication first
    const response = await api.post<ApiResponse>("/api-token-auth/", {
      username: email, // Token auth usually uses 'username' field
      password,
    });

    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      return response.data;
    }

    // Fallback to session authentication
    const sessionResponse = await api.post<ApiResponse>("/api/auth/login/", {
      email,
      password,
    });

    if (sessionResponse.data.key) {
      localStorage.setItem("authToken", sessionResponse.data.key);
    }

    return sessionResponse.data;
  } catch (err: any) {
    console.error("Login error:", err.response?.data || err.message);
    throw new Error(
      err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.error ||
        "Login failed: check email and password"
    );
  }
}

export async function getCurrentUser() {
  try {
    const response = await api.get("/api/auth/user/");
    return response.data;
  } catch (err: any) {
    console.error("User fetch error:", err.response?.data || err.message);
    throw new Error("Failed to fetch user");
  }
}

export async function signOut() {
  try {
    await api.post("/api/auth/logout/");
  } catch (err: any) {
    console.error("Logout error:", err.response?.data || err.message);
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
    console.error("Registration error:", err.response?.data || err.message);
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
    console.error("API connection test failed:", error);
    return false;
  }
}
