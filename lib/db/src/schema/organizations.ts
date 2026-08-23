import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // Same "es"/"en" convention as clients.language — kept independently since
  // an organization (Client Room) can in principle diverge from its parent
  // client's language, though it's not consulted by the DocuSeal send flow
  // today (that reads clients.language, see routes/contracts.ts).
  language: text("language").notNull().default("es"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Organization = typeof organizationsTable.$inferSelect;
