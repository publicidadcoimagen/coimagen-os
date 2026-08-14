import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { subscriptionsTable } from "./subscriptions";

// Dedup log for the "subscription stuck in pending_authorization" staff
// alert — same unique-constraint-as-safety-net pattern as
// commercial_followups (P-80) and invoice_reminders (P-69). Sent at most
// ONCE per subscription, not re-sent daily while it stays stuck; if
// Camila wants a repeat nudge later, that's a deliberate follow-up change.
export const subscriptionAlertsTable = pgTable("subscription_alerts", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // "pending_authorization_stale" (only stage today)
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.subscriptionId, table.stage),
]);

export type SubscriptionAlert = typeof subscriptionAlertsTable.$inferSelect;
export type SubscriptionAlertInsert = typeof subscriptionAlertsTable.$inferInsert;
