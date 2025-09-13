// src/api/api.ts
const API_URL = "http://127.0.0.1:8000/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders() {
  return authToken ? { Authorization: `Token ${authToken}` } : {};
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Login failed");
  const data = await response.json();
  // store token
  setAuthToken(data.key);
  return data;
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}/auth/user/`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
}

export async function signOut() {
  await fetch(`${API_URL}/auth/logout/`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  setAuthToken(null);
}

export async function signUp(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Registration failed");
  const data = await response.json();
  // store token
  setAuthToken(data.key);
  return data;
}
