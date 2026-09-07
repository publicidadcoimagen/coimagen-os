import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

// One contact declared by the client per module/area, purely informational —
// a self-declaration, not a real access-control record. No new login/auth is
// created for these people.
export interface ClientOnboardingModuleContact {
  module: string;
  contactName: string;
  contactEmail: string | null;
  notes: string | null;
}

export const clientOnboardingTable = pgTable("client_onboarding", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique().references(() => clientsTable.id, { onDelete: "cascade" }),
  hasLogo: boolean("has_logo").notNull().default(false),
  hasWebsiteAccess: boolean("has_website_access").notNull().default(false),
  hasDomainAccess: boolean("has_domain_access").notNull().default(false),
  hasHostingAccess: boolean("has_hosting_access").notNull().default(false),
  hasFacebookAccess: boolean("has_facebook_access").notNull().default(false),
  hasInstagramAccess: boolean("has_instagram_access").notNull().default(false),
  hasGoogleBusinessAccess: boolean("has_google_business_access").notNull().default(false),
  hasWhatsappAccess: boolean("has_whatsapp_access").notNull().default(false),
  hasBrandColors: boolean("has_brand_colors").notNull().default(false),
  hasBusinessInfo: boolean("has_business_info").notNull().default(false),
  moduleContacts: jsonb("module_contacts").$type<ClientOnboardingModuleContact[]>().notNull().default([]),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertClientOnboardingSchema = createInsertSchema(clientOnboardingTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientOnboarding = z.infer<typeof insertClientOnboardingSchema>;
export type ClientOnboarding = typeof clientOnboardingTable.$inferSelect;
