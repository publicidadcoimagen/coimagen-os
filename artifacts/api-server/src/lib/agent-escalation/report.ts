import { logger } from "../logger";
import { isOnCooldown, recordFired, insertIncident } from "./repository";
import { notifyStaff } from "./email";

// Same cadence proven in client-room-error-alert: every occurrence gets its
// own incident row regardless of cooldown; only the notification email is
// throttled, per category, so a burst of the same failure type doesn't
// spam the inbox while still leaving a full trail in Quality Center.
const FAILURE_COOLDOWN_MINUTES = 15;

export interface ReportAgentFailureInput {
  agentName: string;
  category: string;
  severity: "low" | "high";
  title: string;
  description: string;
  // Set false for a category that's the system working as designed rather
  // than an urgent failure (e.g. Autopublicador's "claim_blocked" — see
  // Motor de Escalación §Decisiones #3). The incident is still recorded
  // either way; only the active notification is skipped.
  notify?: boolean;
}

export async function reportAgentFailure(input: ReportAgentFailureInput): Promise<void> {
  await insertIncident({
    agentName: input.agentName,
    category: input.category,
    severity: input.severity,
    title: input.title,
    description: input.description,
  });

  if (input.notify === false) return;

  const cooldownKey = `failure:${input.agentName}:${input.category}`;
  if (await isOnCooldown(cooldownKey, FAILURE_COOLDOWN_MINUTES)) return;

  try {
    const emailId = await notifyStaff(`⚠️ ${input.title}`, [input.description]);
    await recordFired(cooldownKey);
    logger.warn({ agentName: input.agentName, category: input.category, emailId }, "Alerta de fallo de agente enviada");
  } catch (err) {
    // The incident is already recorded — a failed notification must not
    // throw back into the caller's request/response flow (matches the
    // best-effort email pattern already used for the digital-diagnosis
    // lead email).
    logger.error({ err, agentName: input.agentName, category: input.category }, "No se pudo enviar la alerta de fallo de agente");
  }
}
