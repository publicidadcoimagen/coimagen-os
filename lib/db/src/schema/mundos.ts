import { pgTable, serial, varchar, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { directorsTable } from "./directors";

export const mundosTable = pgTable("mundos", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull().default("🌍"),
  description: text("description"),
  objetivo: text("objetivo"),
  kpis: jsonb("kpis").$type<string[]>().default([]),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  directorId: integer("director_id").references(() => directorsTable.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Mundo = typeof mundosTable.$inferSelect;
export type MundoInsert = typeof mundosTable.$inferInsert;
