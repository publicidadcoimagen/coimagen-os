import cron from "node-cron";
import { logger } from "../logger";
import { countRecentIncidents, isOnCooldown, recordFired } from "./repository";
import { notifyStaff } from "./email";

export interface VolumeAnomalyConfig {
  agentName: string;
  windowMinutes: number;
  threshold: number;
  cooldownMinutes: number;
}

// Only Autopublicador Social in Fase 1 (Motor de Escalación §Decisiones #1
// — Digital Diagnosis Agent stays on its existing anthropic-balance-alert
// module for now, migrates in Fase 2). Threshold/window are the accepted
// starting point (§Decisiones #2), not yet tuned against real incident
// volume — revisit once this has run for a while.
const REGISTERED_AGENTS: VolumeAnomalyConfig[] = [
  { agentName: "Autopublicador Social", windowMinutes: 60, threshold: 5, cooldownMinutes: 60 },
];

// Generalizes the windowed-count pattern anthropic-balance-alert already
// proved in production (detectFallbackUsed/detectExecutionFailed) — reads
// the same incidents rows reportAgentFailure() writes, so volume anomaly
// detection needs no table of its own.
export async function checkVolumeAnomaly(config: VolumeAnomalyConfig): Promise<void> {
  const count = await countRecentIncidents(config.agentName, config.windowMinutes);
  if (count < config.threshold) return;

  const cooldownKey = `spike:${config.agentName}`;
  if (await isOnCooldown(cooldownKey, config.cooldownMinutes)) return;

  try {
    const emailId = await notifyStaff(
      `⚠️ ${count} fallos de ${config.agentName} en los últimos ${config.windowMinutes} min`,
      [`Se registraron ${count} incidentes de "${config.agentName}" en los últimos ${config.windowMinutes} minutos, por encima del umbral de ${config.threshold}. Revisa Quality Center para el detalle de cada uno.`],
    );
    await recordFired(cooldownKey);
    logger.warn({ agentName: config.agentName, count, emailId }, "Alerta de anomalía de volumen enviada");
  } catch (err) {
    logger.error({ err, agentName: config.agentName, count }, "No se pudo enviar la alerta de anomalía de volumen");
  }
}

// Hourly, same node-cron + America/Tijuana convention as every other
// scheduled job here (e.g. registerAnthropicBalanceAlertCron). One cron
// checks every registered agent in turn, instead of one cron per agent.
export function registerAgentEscalationCron(): void {
  cron.schedule(
    "0 * * * *",
    () => {
      for (const config of REGISTERED_AGENTS) {
        checkVolumeAnomaly(config).catch((err) => {
          logger.error({ err, agentName: config.agentName }, "Fallo el chequeo de anomalía de volumen");
        });
      }
    },
    { timezone: "America/Tijuana" },
  );
}
