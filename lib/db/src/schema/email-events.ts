import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { diagnosesTable } from "./diagnoses";

// Populated from Resend webhook deliveries (delivered/bounced/complained/
// sent). Exists because until this table, a successful send in our own
// logs (Resend accepted the message) was indistinguishable from the
// recipient actually receiving it — see the 2026-07-28 "diagnosis
// generated but email never arrived" investigation, where Resend had, in
// fact, accepted the send and there was no other way to tell what happened
// to it afterward.
export const emailEventsTable = pgTable("email_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("resend"),
  // Resend's own event type, e.g. "email.delivered", "email.bounced",
  // "email.complained", "email.sent" — kept as the raw string rather than
  // an enum so a new Resend event type doesn't require a schema migration
  // to start recording.
  eventType: text("event_type").notNull(),
  // Resend's message id (data.email_id in the webhook payload) — matches
  // the id returned by resend.emails.send() and, for diagnosis emails,
  // diagnosesTable.leadEmailId.
  emailId: text("email_id").notNull(),
  recipient: text("recipient"),
  diagnosisId: integer("diagnosis_id").references(() => diagnosesTable.id, { onDelete: "set null" }),
  // Full raw webhook payload, kept as-is for debugging fields this table
  // doesn't promote to their own column (e.g. the bounce sub-object).
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmailEvent = typeof emailEventsTable.$inferSelect;
