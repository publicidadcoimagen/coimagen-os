import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { agentsTable } from "./agents";

export const backlogItemsTable = pgTable("backlog_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  epic: text("epic"),
  priority: text("priority").notNull().default("medium"),
  assignee: text("assignee"),
  sprint: text("sprint"),
  status: text("status").notNull().default("backlog"),
  dueDate: text("due_date"),
  checklist: text("checklist"),
  notes: text("notes"),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertBacklogItemSchema = createInsertSchema(backlogItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBacklogItem = z.infer<typeof insertBacklogItemSchema>;
export type BacklogItem = typeof backlogItemsTable.$inferSelect;
