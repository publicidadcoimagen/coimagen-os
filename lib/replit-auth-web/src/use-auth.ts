/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from "react";
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

export function useAuth(): AuthState {
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    logout,
  };
}
