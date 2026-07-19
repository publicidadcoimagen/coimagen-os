/// <reference types="vite/client" />
import {
  createContext,
  createElement,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { createAuthClient } from "better-auth/react";
import { customFetch, type AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

// Explicit baseURL: Better Auth's own env-based auto-detection reads
// `process.env`, which doesn't exist in a Vite browser bundle, so it would
// silently no-op here. Falls back to same-origin (Better Auth's default)
// when the var is unset, matching local dev.
const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
});

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
}

// A shared Context is essential here: multiple components (AuthGate,
// LoginForm, page components reading `user`) each consume this state, and
// they must all observe the same session. Without it, each caller of
// useAuth() would get its own independent useState instance — a successful
// sign-in in LoginForm would never be seen by AuthGate, which would keep
// rendering the login screen forever (only a full page reload, which
// re-runs the initial session fetch, would reveal the already-authenticated
// session).
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetchUser = useCallback(async () => {
    try {
      const data = await customFetch<{ user: AuthUser | null }>("/api/auth/user", {
        credentials: "include",
      });
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refetchUser().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refetchUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        return { error: error.message ?? "No se pudo iniciar sesión" };
      }
      await refetchUser();
      return { error: null };
    },
    [refetchUser],
  );

  const logout = useCallback(() => {
    authClient.signOut().finally(() => setUser(null));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      logout,
    }),
    [user, isLoading, signIn, logout],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return state;
}
