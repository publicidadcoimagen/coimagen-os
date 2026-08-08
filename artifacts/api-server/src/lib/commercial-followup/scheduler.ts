import cron from "node-cron";
import { logger } from "../logger";
import { findDueFollowups, recordFollowupSent } from "./repository";
import { sendFollowupEmail } from "./email";
import { ensureCommercialFollowupAgent } from "./agent";

// One prospect's send is independent of every other's — a failure on one
// must never block or duplicate-risk the rest of the batch. Best-effort per
// item, same philosophy as sendDigitalDiagnosisEmail's internal-notification
// step: log and move on, don't let one bad address take down the run.
export async function runCommercialFollowupJob(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await findDueFollowups(now);
  let sent = 0;
  let failed = 0;

  for (const { prospect, stage, proposalPublicToken } of due) {
    // findDueFollowups already filters out emailless prospects — this is
    // just narrowing the type for sendFollowupEmail, not a real branch.
    if (!prospect.email) continue;
    try {
      const lang = prospect.language === "en" ? "en" : "es";
      const emailId = await sendFollowupEmail(stage, prospect.name, prospect.email, prospect.company, lang, proposalPublicToken);
      await recordFollowupSent(prospect.id, stage, emailId);
      logger.info({ prospectId: prospect.id, email: prospect.email, stage, emailId }, "Correo de seguimiento comercial enviado");
      sent++;
    } catch (err) {
      logger.warn({ err, prospectId: prospect.id, email: prospect.email, stage }, "No se pudo enviar el correo de seguimiento comercial");
      failed++;
    }
  }

  return { sent, failed };
}

// Runs once a day at 09:00 America/Tijuana (matches the agency's own
// timezone — sales emails shouldn't land at 3am for a Baja California
// prospect). Registered once at server boot; node-cron keeps its own
// internal interval, no external scheduler needed for this volume.
export function registerCommercialFollowupCron(): void {
  ensureCommercialFollowupAgent().catch((err) => {
    logger.error({ err }, "No se pudo crear/verificar el Agente de Seguimiento Comercial");
  });

  cron.schedule(
    "0 9 * * *",
    () => {
      runCommercialFollowupJob().catch((err) => {
        logger.error({ err }, "Fallo el job de seguimiento comercial");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
