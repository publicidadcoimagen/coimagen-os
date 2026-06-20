import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const configTable = pgTable("config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConfigSchema = createInsertSchema(configTable).omit({ id: true, updatedAt: true });
export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Config = typeof configTable.$inferSelect;
