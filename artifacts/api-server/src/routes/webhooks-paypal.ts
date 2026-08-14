import { type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, invoicePaymentsTable, invoicesTable, subscriptionsTable, clientsTable } from "@workspace/db";
import { verifyPaypalWebhookSignature } from "../lib/paypal/webhook-verify";
import { handleInstallmentPaid } from "../lib/payment-schedule/on-installment-paid";
import { sendStaleSubscriptionAlertEmail } from "../lib/subscription-alerts/email";
import { logger } from "../lib/logger";

interface PaypalEvent {
  event_type?: string;
  resource?: {
    id?: string;
    billing_agreement_id?: string;
    amount?: { total?: string; value?: string; currency?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

// Handles PAYMENT.CAPTURE.COMPLETED — the durable, idempotent source of
// truth that an installment was actually paid. The synchronous
// capture-paypal-order route deliberately never touches invoice/payment
// status itself (see that route's comment) — this is the only place that
// does, guarded by invoice_payments.status so a duplicate webhook delivery
// (PayPal's own docs warn delivery is "at least once") is a no-op.
async function handleCaptureCompleted(event: PaypalEvent): Promise<void> {
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
  const captureId = event.resource?.id;
  if (!orderId) return;

  const [payment] = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.paypalOrderId, orderId));
  if (!payment) {
    logger.warn({ orderId }, "Webhook de PayPal para una orden que no reconocemos — ignorado");
    return;
  }
  if (payment.status === "captured") return; // already processed — the actual dedup guard

  await db.update(invoicePaymentsTable).set({ status: "captured", paypalCaptureId: captureId ?? null, capturedAt: new Date() })
    .where(eq(invoicePaymentsTable.id, payment.id));
  await handleInstallmentPaid(payment.invoiceId);
}

async function handleSubscriptionActivated(event: PaypalEvent): Promise<void> {
  const subId = event.resource?.id;
  if (!subId) return;
  await db.update(subscriptionsTable).set({ status: "active", updatedAt: new Date() }).where(eq(subscriptionsTable.paypalSubscriptionId, subId));
}

async function handleSubscriptionCancelled(event: PaypalEvent): Promise<void> {
  const subId = event.resource?.id;
  if (!subId) return;
  await db.update(subscriptionsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscriptionsTable.paypalSubscriptionId, subId));
}

// A successful recurring monthly charge — records it as a paid invoice so
// the existing revenue dashboard / client-portal invoice list stay
// accurate without any changes on their end. Dedup reuses the same
// invoice_payments.paypalOrderId unique constraint as one-time cuotas
// (here it holds PayPal's sale/transaction id instead of an Orders API
// order id — same role, a globally-unique PayPal-issued charge id).
async function handleRecurringPaymentCompleted(event: PaypalEvent): Promise<void> {
  const saleId = event.resource?.id;
  const subId = event.resource?.billing_agreement_id;
  if (!saleId || !subId) return;

  const [existing] = await db.select({ id: invoicePaymentsTable.id }).from(invoicePaymentsTable).where(eq(invoicePaymentsTable.paypalOrderId, saleId));
  if (existing) return; // already recorded

  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.paypalSubscriptionId, subId));
  if (!subscription?.clientId) {
    logger.warn({ subId }, "Cobro recurrente de PayPal para una suscripción que no reconocemos — ignorado");
    return;
  }

  const amount = event.resource?.amount?.total ?? event.resource?.amount?.value ?? subscription.amount;
  const currency = event.resource?.amount?.currency ?? event.resource?.amount?.currency_code ?? "MXN";
  const today = new Date().toISOString().slice(0, 10);

  const [invoice] = await db.insert(invoicesTable).values({
    number: `SUB${subscription.id}-${saleId}`,
    clientId: subscription.clientId,
    proposalId: subscription.proposalId,
    amount,
    currency,
    status: "paid",
    issuedDate: today,
    dueDate: today,
    description: `Cobro mensual — ${subscription.plan}`,
  }).returning();

  await db.insert(invoicePaymentsTable).values({
    invoiceId: invoice.id,
    paypalOrderId: saleId,
    status: "captured",
    amount,
    ivaAmount: "0",
    currency,
    capturedAt: new Date(),
  });
}

// A recurring charge failed — real money going wrong needs a human, sent
// best-effort with no dedup table (unlike the 3-day pending_authorization
// alert): a duplicate webhook delivery here means staff gets the same
// warning twice, an acceptable imperfection given this only fires on
// genuine payment failures, not routine traffic.
async function handleRecurringPaymentFailed(event: PaypalEvent): Promise<void> {
  const subId = event.resource?.billing_agreement_id ?? event.resource?.id;
  if (!subId) return;
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.paypalSubscriptionId, subId));
  if (!subscription?.clientId) return;

  const [client] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, subscription.clientId));
  const clientName = client?.name ?? `cliente #${subscription.clientId}`;
  try {
    await sendStaleSubscriptionAlertEmail(`${clientName} (cobro recurrente FALLIDO, no pendiente de autorización)`, subscription.id);
  } catch (err) {
    logger.error({ err, subscriptionId: subscription.id }, "No se pudo enviar la alerta de cobro recurrente fallido");
  }
}

// Public, unauthenticated at the Express level — protected instead by
// PayPal's own server-to-server signature verification (see
// webhook-verify.ts). Ordinary parsed JSON body, same as Jotform: PayPal's
// verify-webhook-signature API re-parses on their end, unlike Resend's
// Svix scheme which needs untouched raw bytes.
export async function paypalWebhookHandler(req: Request, res: Response): Promise<void> {
  let verified: boolean;
  try {
    verified = await verifyPaypalWebhookSignature(req.headers, req.body);
  } catch (err) {
    logger.error({ err }, "PAYPAL_WEBHOOK_ID no configurada o error al verificar — webhook de PayPal rechazado");
    res.status(503).json({ error: "Webhook no configurado" });
    return;
  }
  if (!verified) {
    logger.warn("Firma de webhook de PayPal inválida — solicitud rechazada");
    res.status(400).json({ error: "Firma inválida" });
    return;
  }

  const event = req.body as PaypalEvent;
  try {
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        await handleCaptureCompleted(event);
        break;
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionActivated(event);
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
        await handleSubscriptionCancelled(event);
        break;
      case "PAYMENT.SALE.COMPLETED":
        await handleRecurringPaymentCompleted(event);
        break;
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        await handleRecurringPaymentFailed(event);
        break;
      default:
        // Unhandled event types are expected — PayPal sends many more
        // than we act on. Acknowledge, don't 400/500.
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: event.event_type }, "Error procesando webhook de PayPal");
    res.status(500).json({ error: "Error interno" });
    return;
  }

  res.status(200).json({ received: true });
}
