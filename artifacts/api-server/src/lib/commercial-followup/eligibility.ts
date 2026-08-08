// Pure day-math for P-80 — no DB, no network, unit-testable in isolation.
// "correo 1" is the digital diagnosis result email (sent synchronously
// elsewhere, day 0). Stages 2-4 are the follow-up sequence: día 1-2 →
// correo 2, día 3-4 → correo 3, día 6 → correo 4.
export const STAGE_MIN_DAYS: Record<number, number> = { 2: 1, 3: 3, 4: 6 };
export const LAST_STAGE = 4;

function daysSince(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
}

// The single stage to send right now, or null if nothing is due. Always
// advances one stage at a time from whatever's already been sent — a
// prospect that's 20 days old and has never been touched gets correo 2
// today, not 2/3/4 all at once. This is deliberate: no prospect should ever
// receive more than one sales email per run, no matter how overdue they
// are. Existing leads "enter from where they belong" because elapsedDays
// is computed from their real createdAt, not from when this job first ran.
export function nextStageToSend(createdAt: Date, now: Date, alreadySentStages: ReadonlySet<number>): number | null {
  const nextStage = alreadySentStages.size === 0 ? 2 : Math.max(...alreadySentStages) + 1;
  if (nextStage > LAST_STAGE) return null;

  const minDays = STAGE_MIN_DAYS[nextStage];
  if (minDays === undefined) return null;

  return daysSince(createdAt, now) >= minDays ? nextStage : null;
}
