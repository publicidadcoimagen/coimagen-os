import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";

// Dedup log for the payment-recovery sequence on an unpaid deposit cuota —
// same unique-constraint-as-safety-net pattern as commercial_followups
// (P-80), invoice_reminders (P-69), and subscription_alerts. One row per
// (invoice, stage), max ever sent/recorded once:
//   "reminder_24h"  — cron-driven, 24h after createdAt, still unpaid.
//   "declined"      — client-driven, the "ya no quiero continuar" button.
//     Not day-gated like the others; can happen any time. Doesn't block
//     the discount stages below — those fire whether the client declined
//     explicitly or simply never responded.
//   "discount_30d"  — cron-driven, 30 days after createdAt, still unpaid.
//   "discount_60d"  — cron-driven, 60 days after createdAt, still unpaid.
// Once either discount stage exists for an invoice, a 10% discount applies
// to every future price computation for it (create-paypal-order, the public
// GET view) — computed fresh each time, invoices.amount itself never
// changes. See lib/payment-recovery/repository.ts.
export const paymentRecoveryAlertsTable = pgTable("payment_recovery_alerts", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // "reminder_24h" | "declined" | "discount_30d" | "discount_60d"
  // Resend message id — for "declined" this is the STAFF notification
  // email (info@coimagenmedia.com), not a client-facing send.
  emailId: text("email_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.invoiceId, table.stage),
]);

export type PaymentRecoveryAlert = typeof paymentRecoveryAlertsTable.$inferSelect;
export type PaymentRecoveryAlertInsert = typeof paymentRecoveryAlertsTable.$inferInsert;
