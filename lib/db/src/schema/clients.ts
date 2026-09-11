import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Portal module keys a client's package can turn on, on top of the base
// modules every client always sees (P-79). Not mutually exclusive.
export const CLIENT_MODULE_KEYS = ["ecommerce", "autopublicador", "seo"] as const;
export type ClientModuleKey = (typeof CLIENT_MODULE_KEYS)[number];

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  industry: text("industry"),
  status: text("status").notNull().default("prospect"),
  notes: text("notes"),
  isFounder: boolean("is_founder").notNull().default(false),
  founderNumber: integer("founder_number"),
  enabledModules: jsonb("enabled_modules").$type<ClientModuleKey[]>().notNull().default([]),
  // Drives which language variant of outbound docs/emails a client receives
  // (e.g. the DocuSeal contract template picked in POST /contracts/:id/send —
  // see routes/contracts.ts). Same "es"/"en" convention as prospects.language.
  language: text("language").notNull().default("es"),
  // Día 5 access gate (Cláusula 9, Coimagen Master Agreement V2) never
  // applies to this client, regardless of subscriptions.status — pilots
  // (Dr. Segovia, Clínica EMT) and Coimagen Media itself, all confirmed
  // indefinite/no-expiration accounts. Deliberately explicit rather than
  // inferred from "no subscription row" (which a client mid-onboarding
  // would also have, and shouldn't read as a permanent exemption).
  accessGateExempt: boolean("access_gate_exempt").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
