import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";

// role="cliente" requests must never see another client's data. These
// helpers force every "whose data" identifier to the caller's own linked
// clientId, ignoring whatever the request itself supplied — list endpoints
// were previously filtering by a client-suppliable query param with no
// ownership check, and single-resource GETs had no check at all (P-78
// audit finding). Staff roles (ceo/admin/viewer) are unrestricted.

export function isClienteRole(req: Request): boolean {
  return req.user?.role === "cliente";
}

// The clientId a "cliente"-role caller is forced to, or null if the caller
// is staff (unrestricted). -1 is used for an unlinked cliente account so it
// matches zero real rows instead of silently seeing everything.
export function ownClientId(req: Request): number | null {
  if (!isClienteRole(req)) return null;
  return req.user?.clientId ?? -1;
}

// True if a cliente-role caller owns the given clientId (staff always own
// everything). Use on single-resource GETs before returning a row.
export function ownsClientId(req: Request, clientId: number | null | undefined): boolean {
  if (!isClienteRole(req)) return true;
  return clientId != null && clientId === (req.user?.clientId ?? -1);
}

// Organization ids a cliente-role caller may see (via organizations.clientId
// membership), or null if the caller is staff (unrestricted).
export async function ownOrgIds(req: Request): Promise<number[] | null> {
  if (!isClienteRole(req)) return null;
  const clientId = req.user?.clientId;
  if (clientId == null) return [];
  const rows = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.clientId, clientId));
  return rows.map((r) => r.id);
}
