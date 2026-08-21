import cron from "node-cron";
import { logger } from "../logger";
import { previousMonth } from "./aggregate";
import { findAutopublicadorClients, buildClientMonthlySummary, reportAlreadySent, recordReportSent } from "./repository";
import { sendSocialMonthlyReportEmail } from "./email";

// Each client's send is independent — a failure on one must never block or
// duplicate-risk the rest, same best-effort-per-item philosophy as every
// other sequence job in this codebase.
export async function runSocialMonthlyReportJob(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const month = previousMonth(now);
  const clients = await findAutopublicadorClients();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const client of clients) {
    if (!client.email) { skipped++; continue; }
    if (await reportAlreadySent(client.id, month)) { skipped++; continue; }

    try {
      const summary = await buildClientMonthlySummary(client.id, month);
      if (!summary.hasActivity) { skipped++; continue; }

      const emailId = await sendSocialMonthlyReportEmail(client.email, client.name, month, summary);
      await recordReportSent(client.id, month, emailId);
      logger.info({ clientId: client.id, month, emailId }, "Reporte mensual de Autopublicador enviado");
      sent++;
    } catch (err) {
      logger.warn({ err, clientId: client.id, month }, "No se pudo enviar el reporte mensual de Autopublicador");
      failed++;
    }
  }

  return { sent, skipped, failed };
}

// 1st of the month, 08:00 — after invoice-reminders (09:00/09:30) and
// commercial-followup (09:00) run on other days, this one only runs once a
// month so there's no real collision risk to stagger around. Same
// America/Tijuana convention as every other scheduled job here.
export function registerSocialMonthlyReportCron(): void {
  cron.schedule(
    "0 8 1 * *",
    () => {
      runSocialMonthlyReportJob().catch((err) => {
        logger.error({ err }, "Fallo el job de reporte mensual de Autopublicador");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
