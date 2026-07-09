import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/permissions";
import { APP_ROLES } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (requiredRoles: readonly AppRole[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const loadRoles = async (authUserId: string | null) => {
    if (!authUserId) {
      setRoles([]);
      return;
    }

    const { data: roleRows, error: roleError } = await supabase
      .from<Database["public"]["Tables"]["user_roles"]["Row"]>("user_roles")
      .select("role")
      .eq("user_id", authUserId);

    if (roleError) {
      console.error("Failed to load user roles:", roleError.message);
      setRoles([]);
      return;
    }

    let nextRoles = (roleRows ?? []).map((row) => String(row.role));

    // Normalize role strings to the canonical frontend `AppRole` values.
    const normalizeRole = (raw: string | null | undefined): AppRole | undefined => {
      if (!raw) return undefined;
      const cleaned = String(raw).trim().toLowerCase().replace(/[-_\s]/g, '');
      if (APP_ROLES.includes(cleaned as AppRole)) return cleaned as AppRole;

      const aliasMap: Record<string, AppRole> = {
        bursar: 'finance',
        accountant: 'finance',
        financestaff: 'finance',
        finance_staff: 'finance',
        systemadmin: 'superadmin',
        system_admin: 'superadmin',
        super_admin: 'superadmin',
        school_admin: 'schooladmin',
      };

      if (aliasMap[cleaned]) return aliasMap[cleaned];
      // fallback: try raw lower without cleaning
      const rawLower = String(raw).trim().toLowerCase();
      if (aliasMap[rawLower]) return aliasMap[rawLower];

      return undefined;
    };

    const normalized = Array.from(
      new Set(
        nextRoles
          .map((r) => normalizeRole(r))
          .filter((r): r is AppRole => Boolean(r))
      )
    );

    if (normalized.length > 0) {
      nextRoles = normalized as string[];
    }

    if (nextRoles.length === 0) {
      const { data: fallbackUser, error: fallbackError } = await supabase
        .from<Database["public"]["Tables"]["users"]["Row"]>("users")
        .select("role")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (fallbackError) {
        console.error("Failed to load legacy user role fallback:", fallbackError.message);
      }

      if (fallbackUser?.role) {
        nextRoles = [String(fallbackUser.role)];
      }
    }

    setRoles(nextRoles as AppRole[]);

    if (import.meta.env.DEV) {
      console.debug("Auth roles loaded", {
        userId: authUserId,
        rawRoles: nextRoles,
        normalizedRoles: nextRoles,
        hasSchoolAdmin: nextRoles.includes("schooladmin") || nextRoles.includes("school_admin"),
      });
    }
  };

  const handleSessionChange = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    await loadRoles(nextSession?.user?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);

    const loadInitialSession = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      await handleSessionChange(initialSession);
    };

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSessionChange(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (requiredRoles: readonly AppRole[]) =>
    requiredRoles.some((requiredRole) => roles.includes(requiredRole));

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    // After login, we can check for force_password_change if we have the user
    // However, it's better to let the App logic check the user object in AuthProvider
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const register = async (email: string, password: string, confirmPassword?: string) => {
    if (confirmPassword && password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    const redirectUrl = `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    // Clear Django DRF token to keep auth systems synchronized
    localStorage.removeItem("authToken");
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  };

  const signOutHandler = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        hasRole,
        hasAnyRole,
        login,
        register,
        updatePassword,
        logout,
        signOut: signOutHandler,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
