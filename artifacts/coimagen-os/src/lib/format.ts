import { format } from "date-fns";

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch (e) {
    return dateStr;
  }
}

// `currency` defaults to "USD" only to keep every pre-existing call site
// that never had a real currency to pass (costs, project budgets, proposal
// totals) rendering exactly as before — this function itself no longer
// assumes USD silently. Always shows the currency code explicitly (e.g.
// "$3,000.00 MXN") instead of relying on Intl's currency symbol alone,
// since "MX$" vs "$" reads as a typo at a glance, not a different currency
// (2026-09-22 currency audit — this was previously hardcoded to USD
// formatting for every amount, MXN or not).
export function formatCurrency(amount?: number | null, currency: string = "USD") {
  if (amount == null) return "-";
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `$${formatted} ${currency}`;
}

// Renders a set of per-currency totals as "$3,000.00 MXN + $300.00 USD" —
// never summed into one number (see revenue.ts's groupByCurrency: no
// exchange-rate mechanism exists anywhere in this system).
export function formatCurrencyBreakdown(entries: { currency: string; amount: number }[] | undefined): string {
  if (!entries || entries.length === 0) return formatCurrency(0, "MXN");
  return entries.map((e) => formatCurrency(e.amount, e.currency)).join(" + ");
}
