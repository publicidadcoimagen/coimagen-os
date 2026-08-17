import { pgTable, serial, text, timestamp, integer, numeric, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { prospectsTable } from "./prospects";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prospectId: integer("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  validUntil: text("valid_until"),
  // "standard" = 50% deposit / 50% final. "large" = 50% deposit / 25%
  // milestone / 25% launch (Contrato Maestro V2, cláusula 4). Staff sets
  // this when drafting the proposal — drives how many invoice installments
  // get generated on approval (see lib/payment-schedule/generate.ts).
  paymentPlan: text("payment_plan").notNull().default("standard"),
  // The ongoing plan fee that starts once every installment above is paid
  // — distinct from `amount`, which is the one-time project total. Null
  // until staff fills it in; a proposal with no recurring component (a
  // one-off project) just leaves this null and no subscription gets
  // created.
  monthlyAmount: numeric("monthly_amount"),
  // MXN or USD — no per-client "catalog currency" concept exists anywhere
  // else in the schema, so this is staff's explicit choice at proposal
  // creation, same as paymentPlan. Propagated as-is to every generated
  // installment invoice (invoices.currency); no conversion ever happens.
  currency: text("currency").notNull().default("MXN"),
  // Opaque, non-sequential identifier for the public view/approve page
  // (/propuesta/:publicToken) — same pattern as diagnosesTable.publicToken,
  // so proposal ids can't be enumerated to browse other prospects' terms.
  // Powers P-80's correo 3/4, which link here instead of a placeholder.
  publicToken: uuid("public_token").notNull().defaultRandom().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
