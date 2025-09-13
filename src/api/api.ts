<<<<<<< HEAD
const API_URL = "http://127.0.0.1:8000/api";

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include", // send cookies automatically
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.non_field_errors?.[0] || "Login failed");
  }

  return response.json();
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}/auth/user/`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // must include cookies
  });

  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
}

export async function signOut() {
  await fetch(`${API_URL}/auth/logout/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}

export async function signUp(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/registration/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.email?.[0] || "Registration failed");
  }

  return response.json();
=======
import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const api = {
    get: <T>(url: string, params?: object) => axiosInstance.get<T>(url, {params}),
    post: <T>(url: string, data: any) => axiosInstance.post<T>(url, data),
    put: <T>(url: string, data: any) => axiosInstance.put<T>(url, data),
    patch: <T>(url: string, data: any) => axiosInstance.patch<T>(url, data),
    delete: <T>(url: string) => axiosInstance.delete<T>(url),
};

export async function signIn(email: string, password: string) {
    const response = await api.post('/auth/login/', {email, password});
    if (response.data.access) {
        localStorage.setItem('authToken', response.data.access);
    }
    return response.data;
}

export async function getCurrentUser() {
    const response = await api.get('/auth/user/');
    return response.data;
}

export async function signOut() {
    await api.post('/auth/logout/', {});
    localStorage.removeItem('authToken');
}

export async function signUp(email: string, password: string) {
    const response = await api.post('/auth/register/', {email, password});
    if (response.data.access) {
        localStorage.setItem('authToken', response.data.access);
    }
    return response.data;
>>>>>>> e7b41164c9bd10dbb2222ed6e84135b2e1ce9ee3
}
