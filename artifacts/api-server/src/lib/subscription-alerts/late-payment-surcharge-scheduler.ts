import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { db, invoicesTable } from "@workspace/db";
import { logger } from "../logger";
import { findSubscriptionsDueForSurcharge, recordSurchargeAlertSent } from "./late-payment-surcharge-repository";
import { computeLatePaymentSurcharge } from "./late-payment-surcharge";
import { sendLatePaymentSurchargeEmail } from "./email";

// Día 3 (Cláusula 9) — a one-time 5% surcharge, invoiced separately from
// the mensualidad and NEVER charged against the recurring billing
// agreement (Camila's explicit instruction: a single Orders API charge the
// client approves on its own /factura/:token page, same mechanism as any
// other one-time invoice in this codebase — no new payment code needed).
// Once created, this invoice is NOT reversed or voided if the mensualidad
// itself later recovers — the surcharge is owed for having been late by
// 3+ days, independent of the mensualidad's own outcome (Camila's call).
export async function runLatePaymentSurchargeJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await findSubscriptionsDueForSurcharge(now);
  let sent = 0;
  let failed = 0;

  for (const { subscription, clientName, clientEmail } of due) {
    try {
      const surchargeAmount = computeLatePaymentSurcharge(parseFloat(subscription.amount));
      const today = now.toISOString().slice(0, 10);
      const [invoice] = await db.insert(invoicesTable).values({
        number: `SUB${subscription.id}-RECARGO-${today}`,
        clientId: subscription.clientId,
        proposalId: subscription.proposalId,
        amount: surchargeAmount.toString(),
        status: "sent",
        issuedDate: today,
        dueDate: today,
        description: `Recargo por pago tardío (5%) — ${subscription.plan}`,
        publicToken: randomUUID(),
      }).returning();

      await recordSurchargeAlertSent(subscription.id);

      if (clientEmail) {
        const emailId = await sendLatePaymentSurchargeEmail(
          clientEmail, clientName, subscription.plan, surchargeAmount, invoice.currency, invoice.publicToken!,
        );
        logger.info({ subscriptionId: subscription.id, invoiceId: invoice.id, emailId }, "Recargo Día 3 facturado y notificado");
      } else {
        logger.info({ subscriptionId: subscription.id, invoiceId: invoice.id }, "Recargo Día 3 facturado — cliente sin email, sin notificación");
      }
      sent++;
    } catch (err) {
      logger.error({ err, subscriptionId: subscription.id }, "No se pudo facturar/notificar el recargo Día 3");
      failed++;
    }
  }

  return { sent, failed };
}

// Runs daily, staggered after the existing subscription-alerts job
// (10:30) — same America/Tijuana convention as every scheduled job in
// this codebase. Registration itself is left PAUSED in index.ts, same as
// subscription-alerts/scheduler.ts and payment-recovery/scheduler.ts: as
// of this writing there are zero real subscriptions in production (no
// client has an active real PayPal recurring billing agreement yet), so
// this would only burn Neon compute on empty-result runs until that
// changes — reactivate alongside those two.
export function registerLatePaymentSurchargeCron(): void {
  cron.schedule(
    "0 11 * * *",
    () => {
      runLatePaymentSurchargeJob().catch((err) => {
        logger.error({ err }, "Fallo el job de recargo Día 3 por pago tardío");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
