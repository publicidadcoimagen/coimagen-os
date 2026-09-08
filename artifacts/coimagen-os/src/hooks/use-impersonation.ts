import { useCallback, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import {
  useImpersonateClient as useImpersonateClientMutation,
  useEndImpersonation as useEndImpersonationMutation,
  setImpersonationToken,
} from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "coimagen:impersonation";

type ImpersonationState = {
  token: string;
  expiresAt: string;
  clientId: number;
  clientSlug: string;
  clientName: string;
} | null;

// Module-level store (not a React Context) so the trigger button, the
// banner, and any other consumer stay in sync without lifting state up —
// there's exactly one impersonation session per tab, matching the
// sessionStorage scoping below (tab-scoped, doesn't survive a browser
// restart, doesn't leak to other tabs).
let state: ImpersonationState = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function clearExpiryTimer() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

function readStorage(): ImpersonationState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NonNullable<ImpersonationState>;
    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(next: ImpersonationState) {
  if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else sessionStorage.removeItem(STORAGE_KEY);
}

// Local-only cleanup (no backend call) — used for the client-side expiry
// backstop. The backend's own expiresAt check in impersonationMiddleware is
// the real enforcement; this just stops the UI from claiming an active
// session past that point and clears the header so later requests aren't
// silently narrowed once the row is expired server-side too.
function endLocally() {
  state = null;
  clearExpiryTimer();
  writeStorage(null);
  setImpersonationToken(null);
  notify();
}

function scheduleExpiry(next: ImpersonationState) {
  clearExpiryTimer();
  if (!next) return;
  const ms = new Date(next.expiresAt).getTime() - Date.now();
  if (ms <= 0) {
    endLocally();
    return;
  }
  expiryTimer = setTimeout(() => {
    toast({ title: "Sesión de 'ver como cliente' expirada", description: "Volviste a tu sesión normal." });
    endLocally();
  }, ms);
}

function setState(next: ImpersonationState) {
  state = next;
  writeStorage(next);
  setImpersonationToken(next?.token ?? null);
  scheduleExpiry(next);
  notify();
}

if (typeof window !== "undefined" && state === null) {
  const restored = readStorage();
  if (restored) {
    state = restored;
    setImpersonationToken(restored.token);
    scheduleExpiry(restored);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return null;
}

export function useImpersonation() {
  const impersonation = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [, navigate] = useLocation();
  const impersonateMutation = useImpersonateClientMutation();
  const endMutation = useEndImpersonationMutation();

  const startImpersonation = useCallback(
    (clientId: number) => {
      impersonateMutation.mutate(
        { id: clientId },
        {
          onSuccess: (result) => {
            setState(result);
            navigate(`/client/${result.clientSlug}`);
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
    [impersonateMutation, navigate],
  );

  const endImpersonation = useCallback(() => {
    const current = state;
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
          endLocally();
          navigate(`/clients/${current.clientId}`);
        },
      },
    );
  }, [endMutation, navigate]);

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
