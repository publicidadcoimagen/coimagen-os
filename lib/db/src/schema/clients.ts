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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
