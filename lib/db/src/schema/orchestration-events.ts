import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const orchestrationEventsTable = pgTable("orchestration_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  destination: text("destination"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  userId: text("user_id"),
  notes: text("notes"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type OrchestrationEvent = typeof orchestrationEventsTable.$inferSelect;
