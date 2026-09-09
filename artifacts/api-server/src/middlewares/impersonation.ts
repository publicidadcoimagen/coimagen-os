import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, clientImpersonationSessionsTable, clientsTable } from "@workspace/db";
import { isSessionUsable, isMutatingMethod, swapToClientRole } from "../lib/impersonation/session";

// Wired in routes/index.ts after requireAuth, before clientRoleGate — swaps
// a staff (ceo/admin) caller's effective role to "cliente" for the duration
// of a single request when a valid, unexpired "Ver como cliente" token is
// presented, so the request runs through the real clientRoleGate/clientScope
// checks exactly as a real client login would.
//
// Falling through to the caller's real (broader) role on a missing, invalid
// or expired token is deliberately safe: the swap only ever narrows access,
// so failing to apply it just means the request proceeds with the caller's
// own permissions — never wider than intended. The frontend independently
// tracks expiresAt and stops sending the header once expired; this check is
// a defensive backstop, not the primary expiry mechanism.
export async function impersonationMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers["x-impersonate-token"];
  if (typeof token !== "string" || !token) { next(); return; }

  const staffUser = req.user;
  if (!staffUser || !["ceo", "admin"].includes(staffUser.role)) { next(); return; }

  const [session] = await db.select().from(clientImpersonationSessionsTable).where(eq(clientImpersonationSessionsTable.token, token));
  if (!isSessionUsable(session, new Date())) { next(); return; }

  if (isMutatingMethod(req.method)) {
    res.status(403).json({ error: "Modo de solo lectura durante 'ver como cliente'." });
    return;
  }

  // Same lookup authMiddleware does for a real cliente-role login — without
  // it, the swapped user keeps the staff's own enabledModules (always [],
  // since a staff AuthUser is never given any), and every module-gated nav
  // item (e.g. Catálogo) silently disappears under impersonation even
  // though the real client's own login shows it correctly.
  const [client] = await db.select({ enabledModules: clientsTable.enabledModules }).from(clientsTable).where(eq(clientsTable.id, session.clientId));
  req.user = swapToClientRole(staffUser, session.clientId, client?.enabledModules ?? []);
  next();
}
