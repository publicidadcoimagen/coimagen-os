import cron from "node-cron";
import { logger } from "../logger";
import { findDueStaffAlerts, findDueClientReminders, recordReminderSent } from "./repository";
import { sendStaffAlertEmail, sendClientReminderEmail } from "./email";

// One invoice's send is independent of every other's — a failure on one
// must never block or duplicate-risk the rest of the batch. Same
// best-effort-per-item philosophy as runCommercialFollowupJob.
export async function runStaffAlertJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await findDueStaffAlerts(now);
  let sent = 0;
  let failed = 0;

  for (const { invoice, clientName, stage } of due) {
    try {
      const emailId = await sendStaffAlertEmail(invoice, clientName, stage);
      await recordReminderSent(invoice.id, "staff", stage, emailId);
      logger.info({ invoiceId: invoice.id, stage, emailId }, "Alerta de facturación enviada a Coimagen");
      sent++;
    } catch (err) {
      logger.warn({ err, invoiceId: invoice.id, stage }, "No se pudo enviar la alerta de facturación a Coimagen");
      failed++;
    }
  }

  return { sent, failed };
}

export async function runClientReminderJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await findDueClientReminders(now);
  let sent = 0;
  let failed = 0;

  for (const { invoice, clientName, clientEmail, stage } of due) {
    // findDueClientReminders already filters out emailless clients — this is
    // just narrowing the type, not a real branch.
    if (!clientEmail) continue;
    try {
      const emailId = await sendClientReminderEmail(invoice, clientName, clientEmail, stage);
      await recordReminderSent(invoice.id, "client", stage, emailId);
      logger.info({ invoiceId: invoice.id, clientEmail, stage, emailId }, "Recordatorio de pago enviado al cliente");
      sent++;
    } catch (err) {
      logger.warn({ err, invoiceId: invoice.id, clientEmail, stage }, "No se pudo enviar el recordatorio de pago al cliente");
      failed++;
    }
  }

  return { sent, failed };
}

// Runs daily, staggered 30 minutes after P-80's commercial-followup cron
// (09:00) to avoid both jobs hitting the DB/Resend at the same instant.
// Same America/Tijuana timezone convention as every other scheduled job in
// this codebase.
export function registerInvoiceRemindersCron(): void {
  cron.schedule(
    "30 9 * * *",
    () => {
      runStaffAlertJob().catch((err) => {
        logger.error({ err }, "Fallo el job de alertas de facturación a Coimagen");
      });
    },
    { timezone: "America/Tijuana" },
  );

  cron.schedule(
    "0 10 * * *",
    () => {
      runClientReminderJob().catch((err) => {
        logger.error({ err }, "Fallo el job de recordatorios de pago a clientes");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
