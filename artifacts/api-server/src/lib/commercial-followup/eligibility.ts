// Pure day-math for P-80 — no DB, no network, unit-testable in isolation.
// "correo 1" is the digital diagnosis result email (sent synchronously
// elsewhere, day 0). Stages 2-4 are the follow-up sequence: día 1-2 →
// correo 2, día 3-4 → correo 3, día 6 → correo 4.
export const STAGE_MIN_DAYS: Record<number, number> = { 2: 1, 3: 3, 4: 6 };
export const LAST_STAGE = 4;

// prospects.source values eligible for Coimagen's internal (clientId-null)
// funnel — see findDueFollowups/scopeConditions in repository.ts and the
// matching read-only view in routes/sequences.ts. Widened for P-82 (Agente
// Prospectador): "diagnostico_digital" is the original source (self-
// submitted /diagnostico form), "agente_prospectador" is added so cold
// outbound leads found by that agent also enter the correo 2/3/4 stage
// sequence once a staff member has reviewed and qualified them. Deliberately
// does NOT affect "correo 1" — that email is sent synchronously, once, only
// from the /public/digital-diagnosis route at diagnosis-creation time (see
// digital-diagnosis/email.ts); this funnel's stage sequence always starts at
// stage 2 (see nextStageToSend below), so a prospect newly eligible here can
// never receive correo 1 through this path. Exported (not duplicated) so the
// route's read-only view in sequences.ts can never drift from what the cron
// itself treats as in-scope.
export const PROSPECTING_FUNNEL_SOURCES = ["diagnostico_digital", "agente_prospectador"] as const;

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
