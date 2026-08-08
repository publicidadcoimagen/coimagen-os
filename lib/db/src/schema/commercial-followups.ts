import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { prospectsTable } from "./prospects";

// Tracks which follow-up email (2, 3, or 4 — "correo 1" is the digital
// diagnosis result email, sent synchronously elsewhere) has already gone out
// to a given prospect, so the P-80 cron never sends the same stage twice and
// always knows where to resume for a prospect it's already touched. The
// unique constraint is the actual safety net — even a bug that runs the
// cron twice concurrently can't produce a duplicate send, the insert itself
// fails.
export const commercialFollowupsTable = pgTable("commercial_followups", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().references(() => prospectsTable.id, { onDelete: "cascade" }),
  stage: integer("stage").notNull(),
  // Resend message id — same correlation pattern as diagnosesTable.leadEmailId.
  emailId: text("email_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.prospectId, table.stage),
]);

export type CommercialFollowup = typeof commercialFollowupsTable.$inferSelect;
export type CommercialFollowupInsert = typeof commercialFollowupsTable.$inferInsert;
