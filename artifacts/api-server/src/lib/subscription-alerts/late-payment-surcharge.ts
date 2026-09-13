// Pure date-math + money-math — no DB, no network. Día 3 of the escalera de
// pago tardío (Cláusula 9): a one-time 5% surcharge on the mensualidad,
// charged as its own separate PayPal Orders API order (never touches the
// recurring billing agreement itself — Camila's explicit instruction, so a
// failed card on file never blocks or gets tangled with this charge). Once
// triggered, the surcharge is owed regardless of whether the mensualidad
// itself later gets paid (by PayPal's own automatic retry, or otherwise) —
// it is not cancelled or refunded by the client catching up separately.

export const SURCHARGE_THRESHOLD_DAYS = 3;
export const SURCHARGE_RATE = 0.05;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `since` is the same anchor the Día 5 access gate uses (evaluate.ts) —
// subscriptions.updatedAt from the moment status flipped to "past_due" —
// so both stages count from one single, already-established point in time
// instead of each inventing its own.
export function isDueForLatePaymentSurcharge(since: Date, now: Date): boolean {
  const days = (now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000);
  return days >= SURCHARGE_THRESHOLD_DAYS;
}

export function computeLatePaymentSurcharge(monthlyAmount: number): number {
  return round2(monthlyAmount * SURCHARGE_RATE);
}
