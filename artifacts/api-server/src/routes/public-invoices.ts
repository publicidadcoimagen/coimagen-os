import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, invoicesTable, invoicePaymentsTable, subscriptionsTable, type Invoice } from "@workspace/db";
import {
  GetPublicInvoiceParams,
  CreatePublicInvoicePaypalOrderParams,
  CreatePublicInvoicePaypalOrderBody,
  CapturePublicInvoicePaypalOrderParams,
  CapturePublicInvoicePaypalOrderBody,
} from "@workspace/api-zod";
import { setRequiresFiscalInvoice } from "../lib/payment-schedule/repository";
import { createOrder, captureOrder } from "../lib/paypal/orders";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function findInvoiceByToken(token: string): Promise<Invoice | null> {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.publicToken, token)).limit(1);
  return invoice ?? null;
}

async function serializeInvoicePublicView(invoice: Invoice) {
  let subscriptionApproveUrl: string | null = null;
  if (invoice.proposalId) {
    const [pending] = await db.select({ url: subscriptionsTable.paypalApproveUrl })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.proposalId, invoice.proposalId), eq(subscriptionsTable.status, "pending_authorization")))
      .limit(1);
    subscriptionApproveUrl = pending?.url ?? null;
  }

  return {
    publicToken: invoice.publicToken!,
    label: invoice.installmentLabel ?? invoice.description ?? "Pago",
    amount: parseFloat(invoice.amount),
    currency: invoice.currency,
    status: invoice.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
    subscriptionApproveUrl,
  };
}

// Public, unauthenticated — powers /factura/:token, same opaque-UUID-token
// pattern as public-proposals.ts.
router.get("/public/invoices/:token", async (req, res): Promise<void> => {
  const parsed = GetPublicInvoiceParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const invoice = await findInvoiceByToken(parsed.data.token);
  if (!invoice || !invoice.publicToken) { res.status(404).json({ error: "Factura no encontrada" }); return; }

  res.json(await serializeInvoicePublicView(invoice));
});

// Creates the PayPal order server-side — amount is always computed from
// the invoice's own stored amount + the client's requiresFiscalInvoice
// choice made right now, never from anything the client could tamper with.
router.post("/public/invoices/:token/create-paypal-order", async (req, res): Promise<void> => {
  const parsedParams = CreatePublicInvoicePaypalOrderParams.safeParse(req.params);
  if (!parsedParams.success) { res.status(400).json({ error: parsedParams.error.message }); return; }
  const parsedBody = CreatePublicInvoicePaypalOrderBody.safeParse(req.body);
  if (!parsedBody.success) { res.status(400).json({ error: parsedBody.error.message }); return; }

  const invoice = await findInvoiceByToken(parsedParams.data.token);
  if (!invoice) { res.status(404).json({ error: "Factura no encontrada" }); return; }
  if (invoice.status === "paid") { res.status(409).json({ error: "Esta cuota ya fue pagada" }); return; }
  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    res.status(409).json({ error: "Esta cuota todavía no está disponible para pago" });
    return;
  }

  await setRequiresFiscalInvoice(invoice.id, parsedBody.data.requiresFiscalInvoice);

  try {
    const order = await createOrder(invoice, parsedBody.data.requiresFiscalInvoice);
    await db.insert(invoicePaymentsTable).values({
      invoiceId: invoice.id,
      paypalOrderId: order.paypalOrderId,
      status: "created",
      amount: order.totalAmount.toString(),
      ivaAmount: order.ivaAmount.toString(),
      currency: order.currency,
    });
    res.json({ paypalOrderId: order.paypalOrderId, totalAmount: order.totalAmount, ivaAmount: order.ivaAmount, currency: order.currency });
  } catch (err) {
    logger.error({ err, invoiceId: invoice.id }, "No se pudo crear la orden de PayPal");
    res.status(502).json({ error: "No se pudo iniciar el pago con PayPal. Intenta de nuevo." });
  }
});

// Synchronous capture — optimistic UI feedback ONLY. Deliberately does not
// touch invoices.status or invoice_payments.status: the
// PAYMENT.CAPTURE.COMPLETED webhook is the durable, idempotent source of
// truth for that (see webhooks-paypal.ts and
// lib/payment-schedule/on-installment-paid.ts). The frontend should poll
// GET /public/invoices/:token afterward to see the confirmed state.
router.post("/public/invoices/:token/capture-paypal-order", async (req, res): Promise<void> => {
  const parsedParams = CapturePublicInvoicePaypalOrderParams.safeParse(req.params);
  if (!parsedParams.success) { res.status(400).json({ error: parsedParams.error.message }); return; }
  const parsedBody = CapturePublicInvoicePaypalOrderBody.safeParse(req.body);
  if (!parsedBody.success) { res.status(400).json({ error: parsedBody.error.message }); return; }

  const invoice = await findInvoiceByToken(parsedParams.data.token);
  if (!invoice) { res.status(404).json({ error: "Factura no encontrada" }); return; }

  try {
    const result = await captureOrder(parsedBody.data.paypalOrderId);
    res.json({ status: result.status });
  } catch (err) {
    logger.error({ err, invoiceId: invoice.id, paypalOrderId: parsedBody.data.paypalOrderId }, "No se pudo capturar la orden de PayPal");
    res.status(502).json({ error: "No se pudo confirmar el pago con PayPal. Si el cargo se realizó, se reflejará en unos momentos." });
  }
});

export default router;
