import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("bug"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  module: text("module"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  workflowId: integer("workflow_id"),
  mundoId: integer("mundo_id"),
  agentId: integer("agent_id"),
  evidences: text("evidences"),
  logs: text("logs"),
  date: text("date"),
  timeSpent: integer("time_spent"),
  responsibleId: text("responsible_id"),
  solution: text("solution"),
  lessonLearned: text("lesson_learned"),
  ticketId: integer("ticket_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Incident = typeof incidentsTable.$inferSelect;
