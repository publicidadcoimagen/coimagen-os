// Pure date-math for P-69 — no DB, no network, unit-testable in isolation.
// Same philosophy as commercial-followup/eligibility.ts.

export type ReminderStage = "upcoming" | "overdue";

// dueDate and today are ISO date strings ("YYYY-MM-DD", as stored in
// invoices.due_date). Lexicographic string comparison matches chronological
// comparison for this format, so no Date parsing is needed for the ordering
// checks — only for the day-arithmetic in addDays.
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Which alert stage (if any) an invoice's due date currently falls into,
// relative to today. "overdue" always wins over "upcoming" — a due date in
// the past is never still "upcoming" no matter the window. Returns null when
// the due date is further out than the window (nothing to send yet).
export function stageForDueDate(dueDate: string, today: string, upcomingWindowDays: number): ReminderStage | null {
  if (dueDate < today) return "overdue";
  if (dueDate <= addDays(today, upcomingWindowDays)) return "upcoming";
  return null;
}
