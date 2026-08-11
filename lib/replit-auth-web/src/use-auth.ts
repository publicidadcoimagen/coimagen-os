/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from "react";
import { createAuthClient } from "better-auth/react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

// No baseURL: Better Auth's client defaults to same-origin, matching how the
// rest of this app calls relative /api/* paths today.
const authClient = createAuthClient();

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    logout,
  };
}
