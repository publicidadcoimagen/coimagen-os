import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientTimelineTable = pgTable("client_timeline", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  eventType: text("event_type").notNull().default("note"),
  title: text("title").notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientTimelineSchema = createInsertSchema(clientTimelineTable).omit({
  id: true,
  createdAt: true,
});
export type InsertClientTimeline = z.infer<typeof insertClientTimelineSchema>;
export type ClientTimeline = typeof clientTimelineTable.$inferSelect;
