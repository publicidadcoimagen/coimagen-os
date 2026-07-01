import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_configured"),
  type: text("type").notNull(),
  credentialsRequired: text("credentials_required"),
  envVars: text("env_vars"),
  lastSync: timestamp("last_sync"),
  responsibleId: text("responsible_id"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  agentId: integer("agent_id"),
  notes: text("notes"),
  errors: text("errors"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Integration = typeof integrationsTable.$inferSelect;
