import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const integrationLogsTable = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull(),
  action: text("action").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntegrationLog = typeof integrationLogsTable.$inferSelect;
