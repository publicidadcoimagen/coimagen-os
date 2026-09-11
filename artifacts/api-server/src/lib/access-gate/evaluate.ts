// Pure evaluation — no DB, no network. Día 5 of the escalera de pago
// tardío (Cláusula 9, Coimagen Master Agreement V2): the ONLY cause this
// gate currently recognizes is a past-due recurring subscription charge,
// and it only actually restricts once GATE_THRESHOLD_DAYS have passed
// since the charge failed — días 0-4 stay "full" (with days 0/3 meant to
// carry their own separate reminders, not built yet). Días 7 (suspensión
// temporal) and 15 (downgrade/cancelación) are separate, not-yet-built
// stages — a "cancelled" subscription deliberately does NOT restrict
// access here; conflating the two would silently expand this gate's scope
// beyond what was authorized.
export type AccessGateAccess = "full" | "restricted";
export type AccessGateCauseCode = "subscription_past_due";

export interface AccessGateState {
  access: AccessGateAccess;
  causeCode: AccessGateCauseCode | null;
  since: Date | null;
}

export interface SubscriptionSnapshot {
  status: string;
  updatedAt: Date | null;
  createdAt: Date;
}

const FULL_ACCESS: AccessGateState = { access: "full", causeCode: null, since: null };

export const GATE_THRESHOLD_DAYS = 5;

// Same shape as payment-recovery/eligibility.ts's daysSince — real Date
// subtraction, no flooring to whole days, so "5 days" means a genuine
// 120-hour window rather than snapping early/late depending on time-of-day.
function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
}

// exempt (Dr. Segovia, Clínica EMT, Coimagen Media — confirmed indefinite,
// no expiration) always wins, before any subscription is even looked at.
// mostRecentSubscription is null for a client with no subscription row at
// all (mid-onboarding, staff-managed, or exempt accounts in practice) —
// nothing to restrict in that case either. `now` is an explicit parameter
// (not defaulted to `new Date()` internally) so this stays a pure,
// deterministic function — callers pass the real clock.
export function evaluateAccessGate(exempt: boolean, mostRecentSubscription: SubscriptionSnapshot | null, now: Date): AccessGateState {
  if (exempt) return FULL_ACCESS;
  if (!mostRecentSubscription) return FULL_ACCESS;
  if (mostRecentSubscription.status !== "past_due") return FULL_ACCESS;

  const since = mostRecentSubscription.updatedAt ?? mostRecentSubscription.createdAt;
  if (daysSince(since, now) < GATE_THRESHOLD_DAYS) return FULL_ACCESS;

  return {
    access: "restricted",
    causeCode: "subscription_past_due",
    since,
  };
}
