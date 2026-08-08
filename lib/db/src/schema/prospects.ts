import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
