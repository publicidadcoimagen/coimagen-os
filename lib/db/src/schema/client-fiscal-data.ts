import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

// RFC/razón social/constancia captured ONCE per client, right before they
// authorize their PayPal recurring subscription on /factura/:token — reused
// for every monthly charge afterward (CASO 2 of the P-payments fiscal-docs
// design). Unlike invoice_fiscal_data (per-cuota, CASO 1), a client's fiscal
// identity for their own recurring plan doesn't change month to month, so
// there's no need to ask again on each billing cycle.
export const clientFiscalDataTable = pgTable("client_fiscal_data", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique().references(() => clientsTable.id, { onDelete: "cascade" }),
  rfc: text("rfc").notNull(),
  razonSocial: text("razon_social").notNull(),
  constanciaFileKey: text("constancia_file_key").notNull(),
  constanciaFileName: text("constancia_file_name").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export type ClientFiscalData = typeof clientFiscalDataTable.$inferSelect;
export type ClientFiscalDataInsert = typeof clientFiscalDataTable.$inferInsert;
