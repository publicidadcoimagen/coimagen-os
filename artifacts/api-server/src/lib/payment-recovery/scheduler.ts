import cron from "node-cron";
import { logger } from "../logger";
import { findDueRecoveries, recordRecoverySent } from "./repository";
import { sendPaymentReminderEmail, sendReactivationOfferEmail } from "./email";
import { applyRecoveryDiscount } from "../payment-schedule/generate";

// One invoice's send is independent of every other's — same best-effort-
// per-item philosophy as every other cron in this codebase (P-69/P-80).
export async function runPaymentRecoveryJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await findDueRecoveries(now);
  let sent = 0;
  let failed = 0;

  for (const { invoice, clientName, clientEmail, stage } of due) {
    // findDueRecoveries already filters out emailless clients — this is
    // just narrowing the type, not a real branch (same pattern as
    // invoice-reminders/scheduler.ts).
    if (!clientEmail) continue;
    try {
      const emailId = stage === "reminder_24h"
        ? await sendPaymentReminderEmail(invoice, clientName, clientEmail)
        : await sendReactivationOfferEmail(invoice, clientName, clientEmail, applyRecoveryDiscount(parseFloat(invoice.amount), true));

      await recordRecoverySent(invoice.id, stage, emailId);
      logger.info({ invoiceId: invoice.id, stage, emailId }, "Correo de recuperación de pago enviado");
      sent++;
    } catch (err) {
      logger.warn({ err, invoiceId: invoice.id, stage }, "No se pudo enviar el correo de recuperación de pago");
      failed++;
    }
  }

  return { sent, failed };
}

// Runs daily, staggered after the other 3 crons (P-80 09:00, P-69 09:30/
// 10:00, subscription-alerts 10:30) — same America/Tijuana convention as
// every scheduled job in this codebase.
export function registerPaymentRecoveryCron(): void {
  cron.schedule(
    "0 11 * * *",
    () => {
      runPaymentRecoveryJob().catch((err) => {
        logger.error({ err }, "Fallo el job de recuperación de pago");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
