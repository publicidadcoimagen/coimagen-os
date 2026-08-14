import { pgTable, serial, integer, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";

// Tracks actual PayPal payment attempts/captures against one invoice
// (cuota). An invoice can have more than one row here (a failed attempt
// followed by a successful retry), but `paypalOrderId` is unique — that's
// the real duplicate-processing guard: PayPal's own webhook delivery is
// "at least once", so the same CHECKOUT.ORDER.APPROVED/PAYMENT.CAPTURE.
// COMPLETED event can arrive twice. The webhook handler checks this row's
// status before ever flipping invoices.status to "paid" — the synchronous
// capture response only updates optimistic UI state, never the invoice
// itself, so there's no race between the two paths over who marks what.
export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  paypalOrderId: text("paypal_order_id").notNull().unique(),
  paypalCaptureId: text("paypal_capture_id"),
  status: text("status").notNull().default("created"), // created | approved | captured | failed | refunded
  // The actual total charged via PayPal — base invoice amount, plus 16%
  // IVA if the client checked "necesito factura fiscal" for this specific
  // cuota (invoices.requiresFiscalInvoice). Deliberately separate from
  // invoices.amount, which always stays the base/nominal project amount.
  amount: numeric("amount").notNull(),
  // The IVA portion specifically (0 when no fiscal invoice was requested)
  // — kept as its own column rather than derived by subtraction, so a
  // fiscal-invoice breakdown (Subtotal + IVA + Total) never depends on
  // floating-point-safe subtraction of two other columns.
  ivaAmount: numeric("iva_amount").notNull().default("0"),
  // Snapshot of the invoice's currency at charge time (MXN or USD) — see
  // invoices.currency comment for why no conversion ever happens here.
  currency: text("currency").notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  capturedAt: timestamp("captured_at"),
});

export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
export type InvoicePaymentInsert = typeof invoicePaymentsTable.$inferInsert;
