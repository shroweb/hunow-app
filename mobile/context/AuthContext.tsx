import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { wpLogin, wpRegister, wpGoogleLogin, fetchMe, clearAuth, restoreSession, fetchAppConfig, type WPUser, type AppConfig } from "@/lib/wpAuth";
import { ensurePushNotificationsForUser } from "@/lib/push";

interface AuthState {
  user: WPUser | null;
  token: string | null;
  appConfig: AppConfig | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshAppConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, appConfig: null, loading: true });

  // Restore persisted session on app launch
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [sessionResult, appConfigResult] = await Promise.allSettled([restoreSession(), fetchAppConfig()]);
      if (!mounted) return;

      const session = sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const appConfig = appConfigResult.status === "fulfilled" ? appConfigResult.value : null;

      if (session) {
        setState({ user: session.user, token: session.token, appConfig, loading: false });
      } else {
        setState({ user: null, token: null, appConfig, loading: false });
      }
    })().catch(() => {
      if (!mounted) return;
      setState({ user: null, token: null, appConfig: null, loading: false });
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!state.token || !state.user) return;
    ensurePushNotificationsForUser(state.token, state.user).catch(() => {
      // Keep auth flow resilient even if push registration fails.
    });
  }, [state.token, state.user]);

  async function login(email: string, password: string) {
    const { token, user } = await wpLogin(email, password);
    const appConfig = state.appConfig ?? await fetchAppConfig();
    setState((prev) => ({ ...prev, user, token, appConfig, loading: false }));
  }

  async function register(name: string, email: string, password: string, referralCode?: string) {
    const { token, user } = await wpRegister(name, email, password, referralCode);
    const appConfig = state.appConfig ?? await fetchAppConfig();
    setState((prev) => ({ ...prev, user, token, appConfig, loading: false }));
  }

  async function loginWithGoogle(idToken: string) {
    const { token, user } = await wpGoogleLogin(idToken);
    const appConfig = state.appConfig ?? await fetchAppConfig();
    setState((prev) => ({ ...prev, user, token, appConfig, loading: false }));
  }

  async function signOut() {
    await clearAuth();
    setState((prev) => ({ ...prev, user: null, token: null, loading: false }));
  }

  async function refreshUser() {
    if (!state.token) return;
    try {
      const [user, appConfig] = await Promise.all([fetchMe(state.token), fetchAppConfig()]);
      setState((prev) => ({ ...prev, user, appConfig: appConfig ?? prev.appConfig }));
    } catch {
      await signOut();
    }
  }

  async function refreshAppConfig() {
    const appConfig = await fetchAppConfig();
    setState((prev) => ({ ...prev, appConfig }));
  }

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithGoogle, register, signOut, refreshUser, refreshAppConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
