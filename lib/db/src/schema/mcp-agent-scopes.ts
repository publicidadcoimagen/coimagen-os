import { pgTable, varchar, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

// Context Engine v0 — the minimal authorization primitive a future Coimagen
// MCP Server will consume (see coimagen-os MCP audit, 2026-09-20, sections
// E/F: today "being staff" means seeing every client with no partition
// between brands, which is fine for a human admin but not for an
// agent/token acting on the MCP's behalf). This table only answers "which
// clientId(s) is this agentKey allowed to touch" — nothing about how that
// identity authenticates is decided here.
//
// Deliberately NOT named/placed near agentsTable/agentClientsTable
// (./agents.ts) — those are an unrelated internal roadmap catalog of
// conceptual agent *roles* assigned to clients for planning purposes
// (mundoId/directorId/promptMaster/kpis/...), not a runtime auth mechanism.
// Reusing that name here would silently let editing the roadmap catalog
// grant real data access.
export const mcpAgentScopesTable = pgTable(
  "mcp_agent_scopes",
  {
    // Opaque identifier for a future MCP token/service-account. No table of
    // agent identities exists yet (Better Auth only has the `bearer` plugin
    // enabled, no `apiKey` plugin) — v0 deliberately doesn't invent one;
    // whatever provisions an agent later decides what string it passes here.
    agentKey: varchar("agent_key", { length: 128 }).notNull(),
    clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    // Free-text reason a human gave this agentKey access to this client —
    // v0 has no admin UI, so this is what makes an allowlist row legible in
    // a raw `select *` later.
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentKey, t.clientId] })],
);

export type McpAgentScope = typeof mcpAgentScopesTable.$inferSelect;
export type McpAgentScopeInsert = typeof mcpAgentScopesTable.$inferInsert;
