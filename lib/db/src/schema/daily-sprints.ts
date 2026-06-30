import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailySprintsTable = pgTable("daily_sprints", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  objective: text("objective"),
  doneYesterday: text("done_yesterday"),
  replitWorking: text("replit_working"),
  todayPlan: text("today_plan"),
  blockers: text("blockers"),
  deliverables: text("deliverables"),
  result: text("result"),
  tomorrowPending: text("tomorrow_pending"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertDailySprintSchema = createInsertSchema(dailySprintsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailySprint = z.infer<typeof insertDailySprintSchema>;
export type DailySprint = typeof dailySprintsTable.$inferSelect;
