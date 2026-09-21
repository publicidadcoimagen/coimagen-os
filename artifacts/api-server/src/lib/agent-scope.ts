import { eq } from "drizzle-orm";
import { db, mcpAgentScopesTable } from "@workspace/db";

// MCP Agent Scope v0 — the single authorization check a future Coimagen MCP
// tool must call before touching any client-specific data. Mirrors
// middlewares/clientScope.ts's fail-closed spirit for role="cliente": an
// agentKey with no rows in mcp_agent_scopes must match zero real clientIds,
// never "sees everything" — unlike staff roles, there is no "unrestricted
// agent" concept here. -1 is the same sentinel clientScope.ts uses, for the
// same reason (never let a real clientId of 0-or-falsy collide with "no
// access", and never rely on an empty array behaving safely in every
// downstream `inArray(...)` call).
//
// ## agentKey is an identifier, NEVER a secret
// `agentKey` is a label used to look up a row in `mcp_agent_scopes` — it is
// NOT a credential and must never be treated as one. In particular:
//   - Do not use the raw agentKey as a bearer token / API key by itself.
//   - It is fine for agentKey to appear in logs, audit trails, or error
//     messages — it identifies WHO is asking, it does not prove WHO they
//     say they are.
// How an agent/token actually proves it owns a given agentKey at runtime —
// hashing, expiration, revocation, rotation — is a SEPARATE, still-pending
// design problem, out of scope for this file and this PR. Whatever that
// mechanism ends up being, it authenticates first and hands this module a
// trusted agentKey; this module only ever answers "given this identifier,
// which clientId(s) is it allowed to touch."
//
// ## Design: making agentOwnsClientId impossible to skip (not implemented yet)
// A boolean-returning function is easy to call and then ignore — nothing
// today stops a future MCP tool from forgetting to check it, or checking it
// and proceeding anyway on `false`. Audit finding F.1 ("collapse of the
// only real tenant boundary") means this specific check deserves more than
// "please remember to call this." Two complementary mechanisms, both still
// to be designed/built when the actual MCP tool layer exists:
//   1. Transport-level choke point (`artifacts/mcp-server`, not built yet):
//      tools are never called directly — a single dispatcher resolves
//      agentKey + the tool's declared clientId, calls agentOwnsClientId
//      BEFORE invoking the tool handler, and the tool registration API
//      itself only accepts handlers of a "clientId-scoped tool" shape, so
//      there is no code path to register a tool that skips the check. Same
//      pattern as `clientRoleGate.ts`'s default-deny single choke point,
//      applied to tools instead of Express routes.
//   2. Data-layer enforcement (buildable independently of #1, in a later
//      PR): stop returning a plain `boolean` from agentOwnsClientId and
//      instead make it the only way to obtain an opaque "scoped access"
//      value; then change client-scoped repository functions to require
//      that value as a parameter instead of a raw `clientId: number` — so
//      calling them without having gone through authorization first is a
//      compile error, not just a missed runtime check ("parse, don't
//      validate"). This is a stronger guarantee than clientScope.ts gives
//      today for human staff, deliberately: a single Express request only
//      needs the check applied once per request, while a tool-calling agent
//      gets a fresh, isolated decision on every single call.
// Recommendation: build both — #2 does not depend on artifacts/mcp-server
// existing and can start as soon as there is a second real caller of this
// module; #1 is the outer belt-and-suspenders once the MCP package exists.
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
