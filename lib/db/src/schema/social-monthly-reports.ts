import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

// Dedup for pendiente #6b's monthly Autopublicador report — same
// unique-constraint-as-dedup pattern as payment_recovery_alerts/
// subscription_alerts, not a status flag anyone has to remember to check.
export const socialMonthlyReportsTable = pgTable("social_monthly_reports", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  // "YYYY-MM" of the reported (already-closed) month.
  month: text("month").notNull(),
  emailId: text("email_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.clientId, table.month),
]);

export type SocialMonthlyReport = typeof socialMonthlyReportsTable.$inferSelect;
