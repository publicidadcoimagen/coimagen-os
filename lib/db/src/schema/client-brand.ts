import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientBrandTable = pgTable("client_brand", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  logoUrl: text("logo_url"),
  brandColors: text("brand_colors"),
  fonts: text("fonts"),
  brandNotes: text("brand_notes"),
  websiteUrl: text("website_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  googleBusinessUrl: text("google_business_url"),
  youtubeUrl: text("youtube_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertClientBrandSchema = createInsertSchema(clientBrandTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientBrand = z.infer<typeof insertClientBrandSchema>;
export type ClientBrand = typeof clientBrandTable.$inferSelect;
