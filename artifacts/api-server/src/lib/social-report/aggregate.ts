// Pure aggregation for pendiente #6b's monthly Autopublicador report — no
// DB, no I/O, fully unit-testable (same "pure eligibility functions"
// pattern as lib/payment-schedule/generate.ts). The caller loads the raw
// rows for one client/month and passes them in here.

export interface TargetRow {
  network: string;
  status: string; // "pending" | "published" | "failed"
}

export interface ItemRow {
  generationCostUsd: string | null; // numeric column, comes back as a string
}

export interface MonthlySummary {
  publishedCount: number;
  byNetwork: Record<string, number>;
  totalCostUsd: number;
  hasActivity: boolean;
}

export function summarizeMonth(targets: TargetRow[], items: ItemRow[]): MonthlySummary {
  const published = targets.filter((t) => t.status === "published");
  const byNetwork: Record<string, number> = {};
  for (const t of published) {
    byNetwork[t.network] = (byNetwork[t.network] ?? 0) + 1;
  }
  const totalCostUsd = items.reduce((sum, item) => sum + (item.generationCostUsd ? parseFloat(item.generationCostUsd) : 0), 0);

  return {
    publishedCount: published.length,
    byNetwork,
    totalCostUsd,
    // Skip clients with genuinely nothing to report — no post published and
    // no cost incurred — rather than send an empty report, per the design
    // doc's "solo clientes... con al menos 1 publicación ese mes".
    hasActivity: published.length > 0,
  };
}

// "YYYY-MM" → the closed calendar-month range [start, end) in UTC, used to
// scope the DB query. Pure and separately testable from summarizeMonth so a
// boundary bug (e.g. off-by-one on month rollover) is caught in isolation.
export function monthRange(month: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`month debe tener formato YYYY-MM: "${month}"`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
}

// The most recently fully-closed month, e.g. run on 2026-09-01 → "2026-08".
export function previousMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based; subtracting 1 from the 1-based "current" gives previous
  const prev = new Date(Date.UTC(year, month - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}
