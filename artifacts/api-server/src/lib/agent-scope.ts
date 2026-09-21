import { eq } from "drizzle-orm";
import { db, mcpAgentScopesTable } from "@workspace/db";

// Context Engine v0 — the single authorization check a future Coimagen MCP
// tool must call before touching any client-specific data. Mirrors
// middlewares/clientScope.ts's fail-closed spirit for role="cliente": an
// agentKey with no rows in mcp_agent_scopes must match zero real clientIds,
// never "sees everything" — unlike staff roles, there is no "unrestricted
// agent" concept here. -1 is the same sentinel clientScope.ts uses, for the
// same reason (never let a real clientId of 0-or-falsy collide with "no
// access", and never rely on an empty array behaving safely in every
// downstream `inArray(...)` call).
const NO_ACCESS: readonly [number] = [-1];

// clientId(s) this agentKey is allowed to touch, or [-1] if none are
// granted. `dbClient` defaults to the real singleton for every production
// caller; overridable so tests can run this against a real embedded
// Postgres (PGlite) — same pattern as prospect-conversion/repository.ts's
// `convertProspectToClient`, and for the same reason (no separate test
// database in this repo).
export async function agentClientIds(
  agentKey: string,
  dbClient: Pick<typeof db, "select"> = db,
): Promise<number[]> {
  const rows = await dbClient
    .select({ clientId: mcpAgentScopesTable.clientId })
    .from(mcpAgentScopesTable)
    .where(eq(mcpAgentScopesTable.agentKey, agentKey));
  return rows.length > 0 ? rows.map((r: { clientId: number }) => r.clientId) : [...NO_ACCESS];
}

// True only if agentKey's allowlist explicitly includes clientId. Call this
// before any future MCP tool reads or writes a specific client's data —
// never assume an agentKey is unrestricted just because it authenticated.
export async function agentOwnsClientId(
  agentKey: string,
  clientId: number | null | undefined,
  dbClient: Pick<typeof db, "select"> = db,
): Promise<boolean> {
  if (clientId == null) return false;
  const ids = await agentClientIds(agentKey, dbClient);
  return ids.includes(clientId);
}
