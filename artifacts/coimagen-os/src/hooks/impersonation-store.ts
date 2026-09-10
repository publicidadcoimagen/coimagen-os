import { setImpersonationToken } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";

// Pulled out of use-impersonation.ts so this state machine (and the
// applyImpersonationStart/End orchestration below) has zero React imports —
// use-impersonation.test.ts imports this file directly to stay clear of
// lib/better-auth-web's `react` peer dependency, which only resolves inside
// Vite's bundler context, not under plain Node/tsx.

const STORAGE_KEY = "coimagen:impersonation";

export type ImpersonationState = {
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

// Both exported so the ordering below (state/token swap, THEN refetch the
// session, THEN navigate) is directly testable without rendering React:
// AuthProvider's `user` is fetched once on mount and never re-runs on its
// own (see use-auth.ts), so without this explicit refreshUser() call the
// nav keeps reading the staff's own cached role/enabledModules after
// impersonation starts (or the client's, after it ends) — a real bug found
// 2026-09-09 via Becky Beck's Catálogo module staying hidden while
// impersonating her, even though the backend (fixed separately, see
// impersonation.ts) already had the right data to serve.
export async function applyImpersonationStart(
  result: NonNullable<ImpersonationState>,
  refreshUser: () => Promise<void>,
  navigate: (path: string) => void,
): Promise<void> {
  setState(result);
  await refreshUser();
  navigate(`/client/${result.clientSlug}`);
}

export async function applyImpersonationEnd(
  current: NonNullable<ImpersonationState>,
  refreshUser: () => Promise<void>,
  navigate: (path: string) => void,
): Promise<void> {
  endLocally();
  await refreshUser();
  navigate(`/clients/${current.clientId}`);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

export function getServerSnapshot() {
  return null;
}

// Only for endImpersonation's synchronous pre-mutation read (it needs the
// live token before the async end-mutation call even starts).
export function getCurrentState() {
  return state;
}
