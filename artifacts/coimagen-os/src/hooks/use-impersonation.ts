import { useCallback, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import {
  useImpersonateClient as useImpersonateClientMutation,
  useEndImpersonation as useEndImpersonationMutation,
  setImpersonationToken,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/better-auth-web";
import { toast } from "@/hooks/use-toast";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  getCurrentState,
  applyImpersonationStart,
  applyImpersonationEnd,
} from "./impersonation-store";

export function useImpersonation() {
  const impersonation = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [, navigate] = useLocation();
  const impersonateMutation = useImpersonateClientMutation();
  const endMutation = useEndImpersonationMutation();
  const { refreshUser } = useAuth();

  const startImpersonation = useCallback(
    (clientId: number) => {
      impersonateMutation.mutate(
        { id: clientId },
        {
          onSuccess: (result) => {
            void applyImpersonationStart(result, refreshUser, navigate);
          },
          onError: (err) => {
            toast({
              title: "No se pudo entrar en modo 'ver como cliente'",
              description: err instanceof Error ? err.message : String(err),
              variant: "destructive",
            });
          },
        },
      );
    },
    [impersonateMutation, navigate, refreshUser],
  );

  const endImpersonation = useCallback(() => {
    const current = getCurrentState();
    if (!current) return;
    // Clear the header BEFORE calling the API: while it's still attached,
    // this very request would be swapped to role "cliente" by
    // impersonationMiddleware and then blocked by clientRoleGate (POST
    // /impersonation/end isn't on its allowlist) — only a real staff
    // session can end a session, by design.
    setImpersonationToken(null);
    endMutation.mutate(
      { data: { token: current.token } },
      {
        onSettled: () => {
          void applyImpersonationEnd(current, refreshUser, navigate);
        },
      },
    );
  }, [endMutation, navigate, refreshUser]);

  const remainingMs = impersonation ? Math.max(0, new Date(impersonation.expiresAt).getTime() - Date.now()) : 0;

  return {
    impersonation,
    isImpersonating: impersonation != null,
    remainingMs,
    startImpersonation,
    endImpersonation,
    isStarting: impersonateMutation.isPending,
  };
}
