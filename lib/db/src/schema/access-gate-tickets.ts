import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

// Día 5 access gate audit trail (Cláusula 9). Separate from the internal
// engineering ticketsTable — that one tracks staff work items
// (assignedToType/Id/Name); this one is a client-facing folio ("GATE-2026-
// 00193", derived from id+createdAt at the API layer, not stored) proving a
// specific blocked action really happened, for a client to reference when
// asking staff to review their account.
export const accessGateTicketsTable = pgTable("access_gate_tickets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  causeCode: text("cause_code").notNull(),
  blockedAction: text("blocked_action"),
  source: text("source").notNull(),
  // (clientId, causeCode, calendar day) collapsed into one string by the
  // caller (e.g. "7:subscription_past_due:2026-09-05") — the real dedupe
  // key. A repeat blocked attempt the same day returns the existing ticket
  // instead of minting a new folio every time.
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAccessGateTicketSchema = createInsertSchema(accessGateTicketsTable).omit({ id: true, createdAt: true });
export type InsertAccessGateTicket = z.infer<typeof insertAccessGateTicketSchema>;
export type AccessGateTicket = typeof accessGateTicketsTable.$inferSelect;
