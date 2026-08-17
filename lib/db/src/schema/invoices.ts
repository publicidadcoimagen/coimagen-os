import { pgTable, serial, text, timestamp, integer, numeric, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { proposalsTable } from "./proposals";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount").notNull(),
  status: text("status").notNull().default("draft"),
  issuedDate: text("issued_date"),
  dueDate: text("due_date"),
  description: text("description"),
  // Links a payment-schedule installment back to the proposal that
  // generated it (see lib/payment-schedule/repository.ts). Null for
  // invoices created the old way (manual staff CRUD, unrelated to a
  // proposal) — this column doesn't change that path at all.
  proposalId: integer("proposal_id").references(() => proposalsTable.id, { onDelete: "set null" }),
  // Opaque public identifier for the /factura/:publicToken page — same
  // pattern as proposalsTable.publicToken/diagnosesTable.publicToken.
  // Nullable because pre-existing staff-created invoices never had one;
  // every installment invoice generated going forward gets one.
  publicToken: uuid("public_token").unique(),
  // Human-readable label for this cuota — "Anticipo (50%)", "Pago final
  // (50%)", "Hito intermedio (25%)" — shown on both the client portal and
  // the public /factura page. Null for non-installment invoices.
  installmentLabel: text("installment_label"),
  // Currency this invoice's `amount` and any PayPal charge against it are
  // denominated in — MXN or USD depending on the client's catalog/pricing.
  // No conversion happens anywhere in this system: IVA (see
  // requiresFiscalInvoice below) is always 16% of `amount` in this SAME
  // currency, never converted.
  currency: text("currency").notNull().default("MXN"),
  // Client's own choice, made at payment time (checkbox on the
  // propuesta/factura page) — NOT automatic. If true, the actual PayPal
  // charge for this cuota is amount + 16% IVA (Mexican fiscal invoice,
  // regardless of the client's own country — Coimagen only invoices from
  // Mexico). If false (default), the client pays `amount` unmodified and
  // no fiscal document is implied — this system only computes the
  // charge total and records the client's request; it does NOT generate
  // an actual SAT-compliant CFDI, that's a separate, unbuilt process.
  requiresFiscalInvoice: boolean("requires_fiscal_invoice").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
