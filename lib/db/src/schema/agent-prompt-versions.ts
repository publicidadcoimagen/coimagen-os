import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents";

export const agentPromptVersionsTable = pgTable("agent_prompt_versions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
  promptText: text("prompt_text").notNull(),
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AgentPromptVersion = typeof agentPromptVersionsTable.$inferSelect;
export type AgentPromptVersionInsert = typeof agentPromptVersionsTable.$inferInsert;
