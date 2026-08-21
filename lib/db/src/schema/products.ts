import { pgTable, serial, text, timestamp, boolean, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

// Generalizes the Becky Beck catalog (P-77, Netlify-Blobs-only, hardcoded
// to one client) into a real multi-tenant table. Images still live in
// Netlify Blobs (see lib/product-images-blobs.ts) — only product data
// moves into Postgres here. See pendientes-5-6 design doc for the full
// rationale.
export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  nameEs: text("name_es").notNull(),
  nameEn: text("name_en").notNull(),
  description: text("description"),
  // Free-text category, not a fixed enum — Becky Beck's bolso/mochila/llavero
  // was already too narrow for a second client before one even existed.
  category: text("category").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  // null = no inventory tracking (unlimited/service-like product), same
  // convention as nullable columns elsewhere in this schema meaning "not
  // applicable" rather than zero.
  stock: integer("stock"),
  sku: text("sku"),
  available: boolean("available").notNull().default(true),
  // Netlify Blobs keys, e.g. "images/{clientId}/{productId}/0" — ordered,
  // first entry is the cover image. Empty array, never null.
  imageKeys: jsonb("image_keys").$type<string[]>().notNull().default([]),
  // Reserved for a future variant model (size/color) — no client has asked
  // for this yet, so no variant CRUD/UI is built against it. Keeping the
  // column now avoids a breaking migration later; see pendientes-5-6.
  variants: jsonb("variants").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
