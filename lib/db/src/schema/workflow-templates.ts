import { pgTable, serial, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const workflowTemplatesTable = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  product: text("product"),
  stages: jsonb("stages").$type<string[]>().notNull().default([]),
  defaultPriority: text("default_priority").notNull().default("medium"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type WorkflowTemplate = typeof workflowTemplatesTable.$inferSelect;
