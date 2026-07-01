import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { mundosTable } from "./mundos";
import { directorsTable } from "./directors";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { workflowsTable } from "./workflows";
import { automationsTable } from "./automations";
import { incidentsTable } from "./incidents";

export const aiExecutionsTable = pgTable("ai_executions", {
  id: serial("id").primaryKey(),
  agentId:      integer("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  agentName:    text("agent_name"),
  mundoId:      integer("mundo_id").references(() => mundosTable.id, { onDelete: "set null" }),
  mundoName:    text("mundo_name"),
  directorId:   integer("director_id").references(() => directorsTable.id, { onDelete: "set null" }),
  directorName: text("director_name"),
  clientId:     integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId:    integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  workflowId:   integer("workflow_id").references(() => workflowsTable.id, { onDelete: "set null" }),
  automationId: integer("automation_id").references(() => automationsTable.id, { onDelete: "set null" }),
  prompt:       text("prompt"),
  inputData:    text("input_data"),
  outputData:   text("output_data"),
  status:       text("status").notNull().default("completed"),
  result:       text("result").notNull().default("simulated"),
  errors:       text("errors"),
  durationMs:   integer("duration_ms"),
  isSimulated:  boolean("is_simulated").notNull().default(true),
  sentToQc:     boolean("sent_to_qc").notNull().default(false),
  qcIncidentId: integer("qc_incident_id").references(() => incidentsTable.id, { onDelete: "set null" }),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at"),
});

export const insertAiExecutionSchema = createInsertSchema(aiExecutionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiExecution = z.infer<typeof insertAiExecutionSchema>;
export type AiExecution = typeof aiExecutionsTable.$inferSelect;
