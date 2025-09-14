import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

// Create Axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // ensure cookies are sent if backend sets them
});

// Automatically attach token if present
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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

interface ApiResponse {
  access?: string;
  [key: string]: any;
}

export async function signIn(email: string, password: string) {
  try {
    const response = await api.post<ApiResponse>("/auth/login/", { email, password });
    // dj-rest-auth with JWT returns access & refresh tokens
    if (response.data.access) {
      localStorage.setItem("authToken", response.data.access);
    }
    return response.data;
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    throw new Error(
      err.response?.data?.non_field_errors?.[0] ||
        "Login failed: check email and password"
    );
  }
}

export async function getCurrentUser() {
  try {
    const response = await api.get("/auth/user/");
    return response.data;
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    throw new Error("Failed to fetch user");
  }
}

export async function signOut() {
  try {
    await api.post("/auth/logout/");
  } finally {
    localStorage.removeItem("authToken");
  }
}

export async function signUp(email: string, password: string) {
  try {
    const response = await api.post<ApiResponse>("/auth/registration/", { email, password });
    if (response.data.access) {
      localStorage.setItem("authToken", response.data.access);
    }
    return response.data;
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    throw new Error(
      err.response?.data?.email?.[0] ||
        "Registration failed: check email format"
    );
  }
}
