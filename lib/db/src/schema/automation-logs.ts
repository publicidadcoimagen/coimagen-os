import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { automationsTable } from "./automations";

export const automationLogsTable = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automationsTable.id, { onDelete: "cascade" }),
  trigger: text("trigger"),
  result: text("result").notNull().default("success"), // success | error | simulated
  actionsExecuted: text("actions_executed"),           // JSON string
  errors: text("errors"),
  durationMs: integer("duration_ms"),
  isTest: boolean("is_test").notNull().default(false),
  userId: text("user_id"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAutomationLogSchema = createInsertSchema(automationLogsTable).omit({ id: true, createdAt: true });
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type AutomationLog = typeof automationLogsTable.$inferSelect;
