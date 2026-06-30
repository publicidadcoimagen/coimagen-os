import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents";
import { projectsTable } from "./projects";

export const agentProjectsTable = pgTable("agent_projects", {
  agentId: integer("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.agentId, t.projectId] })]);
