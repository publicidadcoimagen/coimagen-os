import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { workflowsTable } from "./workflows";

export const workflowStageLogsTable = pgTable("workflow_stage_logs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflowsTable.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  note: text("note"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkflowStageLog = typeof workflowStageLogsTable.$inferSelect;
