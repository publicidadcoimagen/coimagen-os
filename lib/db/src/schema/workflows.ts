import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";

export const workflowsTable = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  product: text("product"),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  currentStage: text("current_stage").notNull().default("lead_received"),
  progress: integer("progress").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
  responsibleId: text("responsible_id"),
  agentIds: jsonb("agent_ids").$type<number[]>(),
  startDate: text("start_date"),
  targetDate: text("target_date"),
  notes: text("notes"),
  blockers: text("blockers"),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Workflow = typeof workflowsTable.$inferSelect;
