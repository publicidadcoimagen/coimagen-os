import cron from "node-cron";
import { logger } from "../logger";
import { detectLowBalanceSignal, getLastAlertSentAt, recordAlertSent, cooldownActive } from "./repository";
import { sendAnthropicBalanceAlertEmail } from "./email";

export async function runAnthropicBalanceAlertJob(now = new Date()): Promise<{ alerted: boolean; reason: string }> {
  const detection = await detectLowBalanceSignal(now);
  if (!detection) return { alerted: false, reason: "no_signal" };

  const lastSentAt = await getLastAlertSentAt();
  if (cooldownActive(lastSentAt, now)) {
    return { alerted: false, reason: "cooldown_active" };
  }

  const emailId = await sendAnthropicBalanceAlertEmail(detection);
  await recordAlertSent(now);
  logger.warn(
    { signal: detection.signal, count: detection.count, emailId },
    "Alerta de saldo bajo de Anthropic enviada",
  );
  return { alerted: true, reason: detection.signal };
}

// Hourly, unlike the daily crons elsewhere in this codebase — a balance
// running out is time-sensitive for a live, unauthenticated public flow
// (Digital Diagnosis), not something a once-a-day check would catch soon
// enough. Same America/Tijuana convention as every other scheduled job here.
export function registerAnthropicBalanceAlertCron(): void {
  cron.schedule(
    "0 * * * *",
    () => {
      runAnthropicBalanceAlertJob().catch((err) => {
        logger.error({ err }, "Fallo el job de alerta de saldo bajo de Anthropic");
      });
    },
    { timezone: "America/Tijuana" },
  );
}
