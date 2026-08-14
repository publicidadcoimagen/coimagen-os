import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";

// Client's RFC/razón social/constancia de situación fiscal for ONE specific
// cuota — captured inline on /factura/:token right before paying, when they
// check "necesito factura fiscal". Blocking: create-paypal-order refuses to
// run if invoices.requiresFiscalInvoice is true and no row exists here yet
// (see public-invoices.ts). One row per invoice — CASO 1 in the P-payments
// fiscal-docs design, independent of client_fiscal_data (the once-per-client
// version used for the recurring monthly subscription, CASO 2).
export const invoiceFiscalDataTable = pgTable("invoice_fiscal_data", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().unique().references(() => invoicesTable.id, { onDelete: "cascade" }),
  rfc: text("rfc").notNull(),
  razonSocial: text("razon_social").notNull(),
  // Netlify Blobs key (see lib/fiscal-blobs.ts) for the uploaded
  // constancia PDF — the bytes never touch this table.
  constanciaFileKey: text("constancia_file_key").notNull(),
  constanciaFileName: text("constancia_file_name").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export type InvoiceFiscalData = typeof invoiceFiscalDataTable.$inferSelect;
export type InvoiceFiscalDataInsert = typeof invoiceFiscalDataTable.$inferInsert;
