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
}
