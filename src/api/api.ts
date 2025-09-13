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
}
