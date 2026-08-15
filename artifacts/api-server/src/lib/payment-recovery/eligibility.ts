// Pure date-math — no DB, no network. Same "advance one stage at a time
// from whatever's already been sent" philosophy as commercial-followup's
// nextStageToSend (P-80), adapted to named stages instead of numbered ones.
// "declined" is deliberately NOT part of this sequence — it's a one-off
// client-triggered event with no day threshold, checked separately by the
// repository layer (it gates reminder_24h, but never the discount stages).
export const RECOVERY_STAGES = ["reminder_24h", "discount_30d", "discount_60d"] as const;
export type RecoveryStage = (typeof RECOVERY_STAGES)[number];

// reminder_24h uses exact hour-precision (real Date subtraction, no
// flooring to whole days) — same style as subscription-alerts/eligibility's
// isStalePendingAuthorization — because "24 horas" is a literal hour
// threshold, not "1 día" in the loose calendar sense commercial-followup's
// daysSince uses.
const STAGE_MIN_DAYS: Record<RecoveryStage, number> = {
  reminder_24h: 1,
  discount_30d: 30,
  discount_60d: 60,
};

function daysSince(createdAt: Date, now: Date): number {
  return (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
}

// The single stage to send right now for this invoice, or null. Never skips
// ahead — an invoice untouched for 90 days still gets reminder_24h today,
// not discount_60d, then picks up the rest on later runs as it becomes due
// for each one in turn.
export function nextRecoveryStageToSend(createdAt: Date, now: Date, alreadySent: ReadonlySet<RecoveryStage>): RecoveryStage | null {
  const sentIndexes = [...alreadySent].map((stage) => RECOVERY_STAGES.indexOf(stage));
  const nextIndex = sentIndexes.length === 0 ? 0 : Math.max(...sentIndexes) + 1;
  const nextStage = RECOVERY_STAGES[nextIndex];
  if (!nextStage) return null; // already sent every stage there is

  return daysSince(createdAt, now) >= STAGE_MIN_DAYS[nextStage] ? nextStage : null;
}
