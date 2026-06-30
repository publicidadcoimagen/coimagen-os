import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignedToType: text("assigned_to_type"),
  assignedToId: text("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  projectId: integer("project_id"),
  clientId: integer("client_id"),
  dueDate: text("due_date"),
  resolvedAt: text("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Ticket = typeof ticketsTable.$inferSelect;
