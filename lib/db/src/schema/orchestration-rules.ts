import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const orchestrationRulesTable = pgTable("orchestration_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event").notNull(),
  condition: text("condition"),
  actions: text("actions"),
  status: text("status").notNull().default("active"),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type OrchestrationRule = typeof orchestrationRulesTable.$inferSelect;
