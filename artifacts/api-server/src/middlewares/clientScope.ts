import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable, clientsTable } from "@workspace/db";
import type { ClientModuleKey } from "@workspace/db";

// role="cliente" requests must never see another client's data. These
// helpers force every "whose data" identifier to the caller's own linked
// clientId, ignoring whatever the request itself supplied — list endpoints
// were previously filtering by a client-suppliable query param with no
// ownership check, and single-resource GETs had no check at all (P-78/P-79
// audit finding). Staff roles (ceo/admin/viewer) are unrestricted.

export function isClienteRole(req: Request): boolean {
  return req.user?.role === "cliente";
}

// The clientId a "cliente"-role caller is forced to, or null if the caller
// is staff (unrestricted). -1 is used for an unlinked cliente account so it
// matches zero real rows instead of silently seeing everything.
export function ownClientId(req: Request): number | null {
  if (!isClienteRole(req)) return null;
  return (req.user as { clientId?: number | null })?.clientId ?? -1;
}

// True if a cliente-role caller owns the given clientId (staff always own
// everything). Use on single-resource GETs before returning a row.
export function ownsClientId(req: Request, clientId: number | null | undefined): boolean {
  if (!isClienteRole(req)) return true;
  return clientId != null && clientId === ((req.user as { clientId?: number | null })?.clientId ?? -1);
}

// True if a cliente-role caller's client has the given module enabled
// (staff always pass). Use to gate an entire module's routes — e.g. the
// Becky Beck catalog under "ecommerce" (P-79) — so a cliente account whose
// client doesn't have that module still gets a clean 403 even though the
// module's own backend has no per-client scoping of its own.
export async function ownsModule(req: Request, moduleKey: ClientModuleKey): Promise<boolean> {
  if (!isClienteRole(req)) return true;
  const clientId = (req.user as { clientId?: number | null })?.clientId;
  if (clientId == null) return false;
  const rows = await db.select({ enabledModules: clientsTable.enabledModules }).from(clientsTable).where(eq(clientsTable.id, clientId));
  return rows[0]?.enabledModules.includes(moduleKey) ?? false;
}

// Organization ids a cliente-role caller may see (via organizations.clientId
// membership), or null if the caller is staff (unrestricted).
export async function ownOrgIds(req: Request): Promise<number[] | null> {
  if (!isClienteRole(req)) return null;
  const clientId = (req.user as { clientId?: number | null })?.clientId;
  if (clientId == null) return [];
  const rows = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.clientId, clientId));
  return rows.map((r) => r.id);
}

// True if a cliente-role caller owns the given orgId (staff always own
// everything). Use on single-resource GETs/mutations keyed by orgId.
export async function ownsOrgId(req: Request, orgId: number | null | undefined): Promise<boolean> {
  if (!isClienteRole(req)) return true;
  if (orgId == null) return false;
  const ids = await ownOrgIds(req);
  return ids != null && ids.includes(orgId);
}
