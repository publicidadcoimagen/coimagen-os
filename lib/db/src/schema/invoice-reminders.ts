import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";

// Tracks which invoice-reminder alert (staff or client, "upcoming" or
// "overdue") has already gone out for a given invoice, so the P-69 cron
// never sends the same alert twice. Same pattern as commercial_followups:
// the unique constraint is the real safety net, not just app logic — even a
// bug that runs the cron twice concurrently can't produce a duplicate send,
// the insert itself fails. `channel` defaults to "email" — WhatsApp (P-69
// part 1's original ask) is deferred to a later phase; the column exists now
// so adding it later doesn't collide with an existing (invoice, audience,
// stage) email row.
export const invoiceRemindersTable = pgTable("invoice_reminders", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  audience: text("audience").notNull(), // "staff" | "client"
  stage: text("stage").notNull(), // "upcoming" | "overdue"
  channel: text("channel").notNull().default("email"), // "email" for now
  emailId: text("email_id"), // Resend message id — same correlation pattern as commercialFollowupsTable.emailId
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.invoiceId, table.audience, table.stage, table.channel),
]);

export type InvoiceReminder = typeof invoiceRemindersTable.$inferSelect;
export type InvoiceReminderInsert = typeof invoiceRemindersTable.$inferInsert;
