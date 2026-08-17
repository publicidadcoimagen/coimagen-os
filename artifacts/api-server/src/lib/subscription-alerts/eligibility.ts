// Pure date-math — no DB, no network. A subscription stuck in
// "pending_authorization" (final installment paid, but the client never
// clicked through PayPal's approval link) for 3+ days needs a human to
// follow up — it must not stay silent indefinitely.

const STALE_AFTER_DAYS = 3;

export function isStalePendingAuthorization(createdAt: Date, now: Date): boolean {
  const days = (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  return days >= STALE_AFTER_DAYS;
}
