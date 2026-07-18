import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

// The content itself (caption, media, schedule, approval state) — agnostic to
// which network(s) it ends up on. One item can fan out to several
// content_calendar_targets, each tracked independently since a post can
// succeed on Facebook and fail on Instagram in the same run.
export const contentCalendarItemsTable = pgTable("content_calendar_items", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  caption: text("caption").notNull(),
  mediaUrls: jsonb("media_urls"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("draft"), // draft | pending_approval | approved | published | failed
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// One row per network a given item targets. publisherMode records which
// branch getPublisherForClient resolved to at publish time, for audit trail.
export const contentCalendarTargetsTable = pgTable("content_calendar_targets", {
  id: serial("id").primaryKey(),
  calendarItemId: integer("calendar_item_id").notNull().references(() => contentCalendarItemsTable.id, { onDelete: "cascade" }),
  network: text("network").notNull(), // e.g. "meta_facebook", "meta_instagram", "linkedin"
  publisherMode: text("publisher_mode"), // "metricool" | "direct" — set when resolved/published
  externalPostId: text("external_post_id"),
  status: text("status").notNull().default("pending"), // pending | published | failed
  publishedAt: timestamp("published_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  unique().on(table.calendarItemId, table.network),
]);

export const insertContentCalendarItemSchema = createInsertSchema(contentCalendarItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentCalendarItem = z.infer<typeof insertContentCalendarItemSchema>;
export type ContentCalendarItem = typeof contentCalendarItemsTable.$inferSelect;

export const insertContentCalendarTargetSchema = createInsertSchema(contentCalendarTargetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentCalendarTarget = z.infer<typeof insertContentCalendarTargetSchema>;
export type ContentCalendarTarget = typeof contentCalendarTargetsTable.$inferSelect;
