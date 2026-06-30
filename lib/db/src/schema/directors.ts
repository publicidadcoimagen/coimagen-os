import { pgTable, serial, varchar, text, jsonb, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";

export const directorsTable = pgTable("directors", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  objetivo: text("objetivo"),
  responsabilidades: jsonb("responsabilidades").$type<string[]>().default([]),
  kpis: jsonb("kpis").$type<string[]>().default([]),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const directorClientsTable = pgTable("director_clients", {
  directorId: integer("director_id").notNull().references(() => directorsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.directorId, t.clientId] })]);

export const directorProjectsTable = pgTable("director_projects", {
  directorId: integer("director_id").notNull().references(() => directorsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.directorId, t.projectId] })]);

export type Director = typeof directorsTable.$inferSelect;
export type DirectorInsert = typeof directorsTable.$inferInsert;
