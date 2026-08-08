import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Nullable since P-81: WhatsApp/Facebook leads captured by the Jotform
  // assistant often only have a phone number, no email. Callers that need
  // an email (e.g. sendDigitalDiagnosisEmail) must check for it explicitly.
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  industry: text("industry"),
  status: text("status").notNull().default("lead"),
  source: text("source"),
  notes: text("notes"),
  // Which language the lead used on the site (e.g. the ES/EN toggle on
  // /diagnostico) — drives which language variant of every outbound email
  // (diagnosis result, P-80 follow-ups) this prospect gets. Defaults to
  // "es" for prospects created before this column existed.
  language: text("language").notNull().default("es"),
  // Null = Coimagen's own leads (the internal tenant). Set = this prospect
  // belongs to a client whose plan includes prospect-tracking (P-81 Fase A
  // — generalizing the Agente de Seguimiento Comercial to be multi-tenant
  // instead of building a separate agent per client).
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
