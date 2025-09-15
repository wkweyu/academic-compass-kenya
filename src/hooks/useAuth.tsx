import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { signIn, signUp, signOut, getCurrentUser } from "@/api/api";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount
  useEffect(() => {
    (async () => {
      try {
        // Check if we have a token
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.log('No auth token found');
          setUser(null);
          setLoading(false);
          return;
        }

        console.log('Auth token found, getting current user...');
        const u = await getCurrentUser();
        console.log('Current user:', u);
        setUser(u);
      } catch (error) {
        console.error('Failed to get current user:', error);
        // Clear invalid token
        localStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    await signIn(email, password);
    const u = await getCurrentUser();
    setUser(u);
  };

  const register = async (email: string, password: string, confirmPassword: string) => {
    await signUp(email, password, confirmPassword);
    const u = await getCurrentUser();
    setUser(u);
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const signOutHandler = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, signOut: signOutHandler }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
