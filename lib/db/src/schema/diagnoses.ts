import { pgTable, serial, text, timestamp, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { prospectsTable } from "./prospects";
import { aiExecutionsTable } from "./ai-executions";

export const diagnosesTable = pgTable("diagnoses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prospectId: integer("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  content: text("content"),
  status: text("status").notNull().default("draft"),
  type: text("type").notNull().default("diagnosis"),
  executionId: integer("execution_id").references(() => aiExecutionsTable.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  pdfUrl: text("pdf_url"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  // Opaque, non-sequential identifier used in the public results page URL
  // (/diagnostico/resultado/:publicToken) so IDs can't be enumerated to
  // browse other businesses' reports.
  publicToken: uuid("public_token").notNull().defaultRandom().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertDiagnosisSchema = createInsertSchema(diagnosesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiagnosis = z.infer<typeof insertDiagnosisSchema>;
export type Diagnosis = typeof diagnosesTable.$inferSelect;
