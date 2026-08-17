import cron from "node-cron";
import { logger } from "../logger";
import { findStalePendingAuthorizations, recordAlertSent } from "./repository";
import { sendStaleSubscriptionAlertEmail } from "./email";

export async function runSubscriptionAlertsJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const stale = await findStalePendingAuthorizations(now);
  let sent = 0;
  let failed = 0;

  for (const { subscription, clientName } of stale) {
    try {
      const emailId = await sendStaleSubscriptionAlertEmail(clientName, subscription.id);
      await recordAlertSent(subscription.id);
      logger.info({ subscriptionId: subscription.id, emailId }, "Alerta de suscripción sin autorizar enviada");
      sent++;
    } catch (err) {
      logger.warn({ err, subscriptionId: subscription.id }, "No se pudo enviar la alerta de suscripción sin autorizar");
      failed++;
    }
  }

  return { sent, failed };
}

// Runs daily, staggered after the other two cron jobs (P-80 at 09:00, P-69
// at 09:30/10:00) — same America/Tijuana convention as every scheduled job
// in this codebase.
export function registerSubscriptionAlertsCron(): void {
  cron.schedule(
    "30 10 * * *",
    () => {
      runSubscriptionAlertsJob().catch((err) => {
        logger.error({ err }, "Fallo el job de alertas de suscripciones sin autorizar");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
