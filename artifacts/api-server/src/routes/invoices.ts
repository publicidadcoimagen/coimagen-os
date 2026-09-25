import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, invoicesTable, clientsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
  ListInvoicesQueryParams,
  UploadInvoiceFiscalDocumentParams,
  UploadInvoiceFiscalDocumentBody,
  ListInvoicePaymentsParams,
  ReleaseInvoicePaymentAttemptParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { isClienteRole, ownClientId } from "../middlewares/clientScope";
import { recordFiscalDocumentUpload, markFiscalDocumentEmailed } from "../lib/fiscal-data/repository";
import { getFiscalDocument } from "../lib/fiscal-blobs";
import { sendFiscalDocumentToClientEmail } from "../lib/fiscal-data/email";
import { listPaymentAttempts, releasePaymentAttempt } from "../lib/payment-schedule/repository";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/invoices", async (req, res): Promise<void> => {
  const qp = ListInvoicesQueryParams.safeParse(req.query);
  let query = db.select({
    id: invoicesTable.id,
    number: invoicesTable.number,
    clientId: invoicesTable.clientId,
    clientName: clientsTable.name,
    amount: invoicesTable.amount,
    currency: invoicesTable.currency,
    status: invoicesTable.status,
    issuedDate: invoicesTable.issuedDate,
    dueDate: invoicesTable.dueDate,
    description: invoicesTable.description,
    createdAt: invoicesTable.createdAt,
    updatedAt: invoicesTable.updatedAt,
    requiresFiscalInvoice: invoicesTable.requiresFiscalInvoice,
  }).from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id)).$dynamic();
  const conditions = [];
  if (isClienteRole(req)) {
    conditions.push(eq(invoicesTable.clientId, ownClientId(req)!));
  } else if (qp.success && qp.data.clientId) {
    conditions.push(eq(invoicesTable.clientId, qp.data.clientId));
  }
  if (qp.success && qp.data.status) conditions.push(eq(invoicesTable.status, qp.data.status));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(invoicesTable.createdAt);
  res.json(rows.map((r) => ({ ...r, amount: parseFloat(r.amount), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null })));
});

router.post("/invoices", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(invoicesTable).values({
    number: parsed.data.number,
    clientId: parsed.data.clientId ?? null,
    amount: parsed.data.amount.toString(),
    currency: parsed.data.currency ?? "MXN",
    status: parsed.data.status ?? "draft",
    issuedDate: parsed.data.issuedDate ?? null,
    dueDate: parsed.data.dueDate ?? null,
    description: parsed.data.description ?? null,
  }).returning();
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.status(201).json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select({
    id: invoicesTable.id, number: invoicesTable.number, clientId: invoicesTable.clientId,
    clientName: clientsTable.name, amount: invoicesTable.amount, currency: invoicesTable.currency, status: invoicesTable.status,
    issuedDate: invoicesTable.issuedDate, dueDate: invoicesTable.dueDate, description: invoicesTable.description,
    createdAt: invoicesTable.createdAt, updatedAt: invoicesTable.updatedAt,
    requiresFiscalInvoice: invoicesTable.requiresFiscalInvoice,
  }).from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id)).where(eq(invoicesTable.id, params.data.id));
  if (!row || (isClienteRole(req) && row.clientId !== ownClientId(req))) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json({ ...row, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.patch("/invoices/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [row] = await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.delete("/invoices/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.sendStatus(204);
});

function serializeAttempt(a: Awaited<ReturnType<typeof listPaymentAttempts>>[number]) {
  return {
    id: a.id,
    status: a.status,
    paypalOrderId: a.paypalOrderId,
    currency: a.currency,
    amount: parseFloat(a.amount),
    createdAt: a.createdAt.toISOString(),
    capturedAt: a.capturedAt ? a.capturedAt.toISOString() : null,
    ageSeconds: a.ageSeconds,
    stillBlocking: a.stillBlocking,
  };
}

// Real payment-attempt evidence for the staff invoice view (2026-09-23,
// same front as PR #84's double-payment guard) — the guard itself never
// had a way for staff to SEE what it's blocking on, only for a client to
// hit the generic "ya hay un pago en proceso" message. Not gated by
// requireRole: any authenticated staff account can view it (matches GET
// /invoices/:id above), cliente-role is already excluded by
// clientRoleGate's default-deny — this path isn't on its allowlist.
router.get("/invoices/:id/payments", async (req, res): Promise<void> => {
  const params = ListInvoicePaymentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [invoice] = await db.select({ id: invoicesTable.id, clientId: invoicesTable.clientId }).from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice || (isClienteRole(req) && invoice.clientId !== ownClientId(req))) { res.status(404).json({ error: "Invoice not found" }); return; }

  const history = await listPaymentAttempts(invoice.id);
  const activeAttempt = history.find((a) => a.stillBlocking) ?? null;
  res.json({
    activeAttempt: activeAttempt ? serializeAttempt(activeAttempt) : null,
    history: history.map(serializeAttempt),
  });
});

// Manual release, for the "Liberar" button next to a stuck attempt in that
// same evidence panel — staff no longer has to wait out the guard window
// (eligibility.ts) or ask Code to run a one-off DB update every time a
// client reports being blocked. requireRole matches every other
// money-affecting action on this router (PATCH/DELETE above).
router.post("/invoices/:id/payments/:paymentId/release", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = ReleaseInvoicePaymentAttemptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [invoice] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  await releasePaymentAttempt(params.data.id, params.data.paymentId);
  logger.info({ invoiceId: params.data.id, paymentId: params.data.paymentId, by: req.user?.email }, "Intento de pago liberado manualmente por staff");

  const history = await listPaymentAttempts(invoice.id);
  const activeAttempt = history.find((a) => a.stillBlocking) ?? null;
  res.json({
    activeAttempt: activeAttempt ? serializeAttempt(activeAttempt) : null,
    history: history.map(serializeAttempt),
  });
});

// Staff uploads the real CFDI PDF once the accountant issues it (generic
// over any invoice — one-time cuota or the auto-created monthly-charge row,
// see webhooks-paypal.ts). Upload always succeeds independent of the email
// step: emailedToClient can come back false if Resend fails, without losing
// the uploaded document — staff can be told to retry the send separately if
// that ever happens, no need to re-upload.
router.post("/invoices/:id/fiscal-document", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UploadInvoiceFiscalDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsedBody = UploadInvoiceFiscalDocumentBody.safeParse(req.body);
  if (!parsedBody.success) { res.status(400).json({ error: parsedBody.error.message }); return; }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!invoice.clientId) { res.status(409).json({ error: "Esta factura no tiene un cliente asociado" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
  if (!client?.email) { res.status(409).json({ error: "El cliente no tiene correo registrado" }); return; }

  let doc;
  try {
    doc = await recordFiscalDocumentUpload(invoice.id, parsedBody.data.fileBase64, parsedBody.data.fileName, req.user?.email ?? null);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo guardar el documento" });
    return;
  }

  let emailedToClient = false;
  try {
    const documentBuffer = await getFiscalDocument(doc.fileKey);
    if (!documentBuffer) throw new Error("No se pudo leer el documento recién subido");
    await sendFiscalDocumentToClientEmail({
      clientEmail: client.email,
      clientName: client.name,
      invoiceLabel: invoice.installmentLabel ?? invoice.description ?? "tu factura",
      documentBuffer,
      fileName: parsedBody.data.fileName,
    });
    await markFiscalDocumentEmailed(doc.id);
    emailedToClient = true;
  } catch (err) {
    logger.error({ err, invoiceId: invoice.id }, "Documento fiscal subido pero no se pudo enviar por correo al cliente");
  }

  res.json({ uploaded: true, emailedToClient });
});

export default router;
