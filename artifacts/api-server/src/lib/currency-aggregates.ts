// MXN and USD are never converted anywhere in this system (no exchange-rate
// mechanism exists — 2026-09-22 currency audit), so a single blended MRR/
// ARR number mixing both is financially meaningless. Every money aggregate
// is grouped into one entry per currency actually present instead — never
// summed across currencies. Shared by revenue.ts and dashboard.ts so both
// screens always agree on the same MRR.

export type CurrencyAmount = { currency: string; amount: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function groupByCurrency(rows: { amount: string; currency: string }[]): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + parseFloat(r.amount));
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: round2(amount) }));
}

export function monthlyEquivalent(s: { amount: string; billingCycle: string }): number {
  const amt = parseFloat(s.amount);
  if (s.billingCycle === "quarterly") return amt / 3;
  if (s.billingCycle === "annual") return amt / 12;
  return amt; // monthly, and any unrecognized cycle (same fallback as before)
}

export function mrrByCurrency(subs: { amount: string; billingCycle: string; currency: string }[]): CurrencyAmount[] {
  return groupByCurrency(subs.map((s) => ({ amount: monthlyEquivalent(s).toString(), currency: s.currency })));
}

export function annualize(mrr: CurrencyAmount[]): CurrencyAmount[] {
  return mrr.map((m) => ({ currency: m.currency, amount: round2(m.amount * 12) }));
}

// costs has no currency column — every cost recorded so far is a USD
// provider bill (Render/Neon/APIs), and the frontend already renders costs
// as USD. So a margin is only meaningful when ALL recurring revenue is USD
// too; with any MXN MRR in the mix it would subtract dollars from pesos.
// Returns null in that case instead of a made-up percentage.
export function usdMarginPercent(mrr: CurrencyAmount[], usdCosts: number): number | null {
  if (mrr.length !== 1 || mrr[0].currency !== "USD" || mrr[0].amount <= 0) return null;
  return Math.round(((mrr[0].amount - usdCosts) / mrr[0].amount) * 1000) / 10;
}
