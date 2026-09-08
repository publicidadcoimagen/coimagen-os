export type ImpersonationSessionRow = {
  endedAt: Date | null;
  expiresAt: Date;
};

// True when a "Ver como cliente" session row is still valid to apply — not
// ended, and not past its 30-minute expiry. Used by impersonationMiddleware
// to decide whether to swap the caller's role, or fall through as their
// real (broader) staff role.
export function isSessionUsable<T extends ImpersonationSessionRow>(
  session: T | null | undefined,
  now: Date,
): session is T {
  if (!session) return false;
  if (session.endedAt) return false;
  return session.expiresAt > now;
}

// True for any request that must be hard-blocked while impersonating —
// "Ver como cliente" is a read-only viewing lens, never an identity switch
// for writes.
export function isMutatingMethod(method: string): boolean {
  return method !== "GET";
}

// Narrows a real staff AuthUser down to the read-only "cliente" view of one
// specific client, for the duration of a single request.
export function swapToClientRole<T extends { role: string; clientId?: number | null }>(
  user: T,
  clientId: number,
): T {
  return { ...user, role: "cliente" as const, clientId } as T;
}
