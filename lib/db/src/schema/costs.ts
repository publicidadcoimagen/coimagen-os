import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const costsTable = pgTable("costs", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  month: text("month").notNull(),
  amount: numeric("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertCostSchema = createInsertSchema(costsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCost = z.infer<typeof insertCostSchema>;
export type Cost = typeof costsTable.$inferSelect;
