import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { agentsTable } from "./agents";
import { workflowsTable } from "./workflows";
import { integrationsTable } from "./integrations";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  // Legacy fields (kept for backward compat)
  platform: text("platform"),
  action: text("action"),
  // New V1.7.3 fields
  triggerType: text("trigger_type"),
  conditions: text("conditions"),      // JSON string
  actionsConfig: text("actions_config"), // JSON string array of actions
  priority: text("priority").notNull().default("medium"),
  nextRun: timestamp("next_run"),
  errors: text("errors"),
  totalExecutions: integer("total_executions").notNull().default(0),
  executionsToday: integer("executions_today").notNull().default(0),
  // Relations
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  workflowId: integer("workflow_id").references(() => workflowsTable.id, { onDelete: "set null" }),
  integrationId: integer("integration_id").references(() => integrationsTable.id, { onDelete: "set null" }),
  // Kept from v1
  trigger: text("trigger"),
  lastRun: text("last_run"),
  result: text("result"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
