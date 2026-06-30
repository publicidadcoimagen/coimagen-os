import { pgTable, serial, text, varchar, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { mundosTable } from "./mundos";
import { directorsTable } from "./directors";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  category: varchar("category", { length: 64 }),
  world: text("world"),
  mundoId: integer("mundo_id").references(() => mundosTable.id, { onDelete: "set null" }),
  directorId: integer("director_id").references(() => directorsTable.id, { onDelete: "set null" }),
  specialty: text("specialty"),
  objetivo: text("objetivo"),
  status: text("status").notNull().default("active"),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  aiModel: varchar("ai_model", { length: 64 }),
  description: text("description"),
  promptMaster: text("prompt_master"),
  inputs: text("inputs"),
  outputs: text("outputs"),
  tools: text("tools"),
  toolsList: jsonb("tools_list").$type<string[]>().default([]),
  kpis: text("kpis"),
  kpisList: jsonb("kpis_list").$type<string[]>().default([]),
  documentation: text("documentation"),
  dependencies: jsonb("dependencies").$type<string[]>().default([]),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Agent = typeof agentsTable.$inferSelect;
export type AgentInsert = typeof agentsTable.$inferInsert;
