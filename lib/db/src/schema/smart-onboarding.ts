import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const smartOnboardingsTable = pgTable("smart_onboardings", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("draft"),
  currentStep: integer("current_step").notNull().default(1),
  step1: jsonb("step1").$type<Record<string, unknown>>(),
  step2: jsonb("step2").$type<Record<string, unknown>>(),
  step3: jsonb("step3").$type<Record<string, unknown>>(),
  step4: jsonb("step4").$type<Record<string, unknown>>(),
  step5: jsonb("step5").$type<Record<string, unknown>>(),
  step6: jsonb("step6").$type<Record<string, unknown>>(),
  step7: jsonb("step7").$type<Record<string, unknown>>(),
  completedEntities: jsonb("completed_entities").$type<Record<string, unknown>>(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type SmartOnboarding = typeof smartOnboardingsTable.$inferSelect;
export type InsertSmartOnboarding = typeof smartOnboardingsTable.$inferInsert;
