import { eq } from "drizzle-orm";
import {
  db,
  invoiceFiscalDataTable,
  clientFiscalDataTable,
  invoiceFiscalDocumentsTable,
  subscriptionsTable,
  type InvoiceFiscalData,
  type ClientFiscalData,
} from "@workspace/db";
import { saveFiscalDocument } from "../fiscal-blobs";

interface FiscalDataInput {
  rfc: string;
  razonSocial: string;
  constanciaBase64: string;
  constanciaFileName: string;
}

export async function getInvoiceFiscalData(invoiceId: number): Promise<InvoiceFiscalData | null> {
  const [row] = await db.select().from(invoiceFiscalDataTable).where(eq(invoiceFiscalDataTable.invoiceId, invoiceId));
  return row ?? null;
}

// CASO 1 — one cuota's fiscal identity, saved right before its PayPal order
// is created. Blocking guard for create-paypal-order lives in
// public-invoices.ts, not here — this just persists the submission.
export async function submitInvoiceFiscalData(invoiceId: number, input: FiscalDataInput): Promise<InvoiceFiscalData> {
  const fileKey = `invoices/${invoiceId}/constancia-${Date.now()}`;
  await saveFiscalDocument(fileKey, input.constanciaBase64);

  const [row] = await db
    .insert(invoiceFiscalDataTable)
    .values({ invoiceId, rfc: input.rfc, razonSocial: input.razonSocial, constanciaFileKey: fileKey, constanciaFileName: input.constanciaFileName })
    .onConflictDoUpdate({
      target: invoiceFiscalDataTable.invoiceId,
      set: { rfc: input.rfc, razonSocial: input.razonSocial, constanciaFileKey: fileKey, constanciaFileName: input.constanciaFileName, submittedAt: new Date() },
    })
    .returning();
  return row;
}

export async function getClientFiscalData(clientId: number): Promise<ClientFiscalData | null> {
  const [row] = await db.select().from(clientFiscalDataTable).where(eq(clientFiscalDataTable.clientId, clientId));
  return row ?? null;
}

// CASO 2 — captured once per client, right before they see
// subscriptions.paypalApproveUrl on /factura/:token. Also flips
// subscriptions.requiresFiscalInvoice so every future monthly charge knows
// to alert staff (see webhooks-paypal.ts's handleRecurringPaymentCompleted).
export async function submitClientFiscalData(clientId: number, subscriptionId: number, input: FiscalDataInput): Promise<ClientFiscalData> {
  const fileKey = `clients/${clientId}/constancia-${Date.now()}`;
  await saveFiscalDocument(fileKey, input.constanciaBase64);

  const [row] = await db
    .insert(clientFiscalDataTable)
    .values({ clientId, rfc: input.rfc, razonSocial: input.razonSocial, constanciaFileKey: fileKey, constanciaFileName: input.constanciaFileName })
    .onConflictDoUpdate({
      target: clientFiscalDataTable.clientId,
      set: { rfc: input.rfc, razonSocial: input.razonSocial, constanciaFileKey: fileKey, constanciaFileName: input.constanciaFileName, submittedAt: new Date() },
    })
    .returning();

  await db.update(subscriptionsTable).set({ requiresFiscalInvoice: true, updatedAt: new Date() }).where(eq(subscriptionsTable.id, subscriptionId));
  return row;
}

// Staff uploading the real CFDI PDF once the accountant issues it —
// generic over any invoice (cuota or auto-created monthly charge).
export async function recordFiscalDocumentUpload(invoiceId: number, dataUri: string, fileName: string, uploadedByEmail: string | null) {
  const fileKey = `documents/${invoiceId}/${Date.now()}-${fileName}`;
  await saveFiscalDocument(fileKey, dataUri);
  const [row] = await db.insert(invoiceFiscalDocumentsTable).values({ invoiceId, fileKey, fileName, uploadedByEmail }).returning();
  return row;
}

export async function markFiscalDocumentEmailed(id: number): Promise<void> {
  await db.update(invoiceFiscalDocumentsTable).set({ emailedToClientAt: new Date() }).where(eq(invoiceFiscalDocumentsTable.id, id));
}
