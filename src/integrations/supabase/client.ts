// src/integrations/supabase/client.ts
// This replaces the Supabase client with a simple REST API wrapper

export const api = {
  async getSession() {
    const res = await fetch("/api/auth/session/", { credentials: "include" });
    return res.ok ? res.json() : null;
  },

  async signIn(email: string, password: string) {
    const res = await fetch("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signUp(email: string, password: string) {
    const res = await fetch("/api/auth/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signOut() {
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "include",
    });
  },
};
