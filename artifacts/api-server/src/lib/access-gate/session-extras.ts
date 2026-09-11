import { eq, sql } from "drizzle-orm";
import { db, clientsTable, subscriptionsTable } from "@workspace/db";
import { evaluateAccessGate, type AccessGateState } from "./evaluate";

export interface ClientSessionExtras {
  enabledModules: string[];
  accessGate: AccessGateState;
}

// authMiddleware and impersonationMiddleware both need enabledModules AND
// accessGate for every cliente-role request (authMiddleware runs on EVERY
// request, not just login) — one combined LEFT JOIN keeps this at the same
// single query these two middlewares already paid before accessGate
// existed, instead of a second round trip per request on top of it.
//
// A client with no subscription row produces one row from the LEFT JOIN
// with every subscription column null; a client with several produces one
// row per subscription, and the ORDER BY + LIMIT 1 picks the one most
// recently touched — same "most recent wins" rule as getAccessGateState.
export async function getClientSessionExtras(clientId: number): Promise<ClientSessionExtras> {
  const [row] = await db.select({
    enabledModules: clientsTable.enabledModules,
    accessGateExempt: clientsTable.accessGateExempt,
    subStatus: subscriptionsTable.status,
    subUpdatedAt: subscriptionsTable.updatedAt,
    subCreatedAt: subscriptionsTable.createdAt,
  }).from(clientsTable)
    .leftJoin(subscriptionsTable, eq(subscriptionsTable.clientId, clientsTable.id))
    .where(eq(clientsTable.id, clientId))
    .orderBy(sql`coalesce(${subscriptionsTable.updatedAt}, ${subscriptionsTable.createdAt}) DESC`)
    .limit(1);

  const now = new Date();
  if (!row) return { enabledModules: [], accessGate: evaluateAccessGate(false, null, now) };

  const subscription = row.subStatus
    ? { status: row.subStatus, updatedAt: row.subUpdatedAt, createdAt: row.subCreatedAt! }
    : null;

  return {
    enabledModules: row.enabledModules ?? [],
    accessGate: evaluateAccessGate(row.accessGateExempt, subscription, now),
  };
}
