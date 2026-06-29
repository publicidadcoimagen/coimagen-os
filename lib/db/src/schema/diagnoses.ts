import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { prospectsTable } from "./prospects";

export const diagnosesTable = pgTable("diagnoses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prospectId: integer("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  content: text("content"),
  status: text("status").notNull().default("draft"),
  type: text("type").notNull().default("diagnosis"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertDiagnosisSchema = createInsertSchema(diagnosesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiagnosis = z.infer<typeof insertDiagnosisSchema>;
export type Diagnosis = typeof diagnosesTable.$inferSelect;
