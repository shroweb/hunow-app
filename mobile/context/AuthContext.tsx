import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { wpLogin, wpRegister, fetchMe, clearAuth, restoreSession, type WPUser } from "@/lib/wpAuth";

interface AuthState {
  user: WPUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  // Restore persisted session on app launch
  useEffect(() => {
    restoreSession().then((session) => {
      if (session) {
        setState({ user: session.user, token: session.token, loading: false });
      } else {
        setState({ user: null, token: null, loading: false });
      }
    });
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await wpLogin(email, password);
    setState({ user, token, loading: false });
  }

  async function register(name: string, email: string, password: string) {
    const { token, user } = await wpRegister(name, email, password);
    setState({ user, token, loading: false });
  }

  async function signOut() {
    await clearAuth();
    setState({ user: null, token: null, loading: false });
  }

  async function refreshUser() {
    if (!state.token) return;
    try {
      const user = await fetchMe(state.token);
      setState((prev) => ({ ...prev, user }));
    } catch {
      await signOut();
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
