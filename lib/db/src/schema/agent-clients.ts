import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents";
import { clientsTable } from "./clients";

export const agentClientsTable = pgTable("agent_clients", {
  agentId: integer("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.agentId, t.clientId] })]);
