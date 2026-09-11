// Pure evaluation — no DB, no network. Día 5 of the escalera de pago
// tardío (Cláusula 9, Coimagen Master Agreement V2): the ONLY cause this
// gate currently recognizes is a past-due recurring subscription charge.
// Días 7 (suspensión temporal) and 15 (downgrade/cancelación) are separate,
// not-yet-built stages — a "cancelled" subscription deliberately does NOT
// restrict access here; conflating the two would silently expand this
// gate's scope beyond what was authorized.
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

// exempt (Dr. Segovia, Clínica EMT, Coimagen Media — confirmed indefinite,
// no expiration) always wins, before any subscription is even looked at.
// mostRecentSubscription is null for a client with no subscription row at
// all (mid-onboarding, staff-managed, or exempt accounts in practice) —
// nothing to restrict in that case either.
export function evaluateAccessGate(exempt: boolean, mostRecentSubscription: SubscriptionSnapshot | null): AccessGateState {
  if (exempt) return FULL_ACCESS;
  if (!mostRecentSubscription) return FULL_ACCESS;
  if (mostRecentSubscription.status !== "past_due") return FULL_ACCESS;

  return {
    access: "restricted",
    causeCode: "subscription_past_due",
    since: mostRecentSubscription.updatedAt ?? mostRecentSubscription.createdAt,
  };
}
