import { Router, type IRouter } from "express";
import { db, subscriptionsTable, invoicesTable, clientsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();

// MXN and USD are never converted anywhere in this system (no exchange-rate
// mechanism exists — 2026-09-22 currency audit), so a single blended MRR/
// ARR/high-ticket number mixing both is financially meaningless. Every
// aggregate below is grouped into one entry per currency actually present
// instead — never summed across currencies.
function groupByCurrency(rows: { amount: string; currency: string }[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + parseFloat(r.amount));
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}

function monthlyEquivalent(s: { amount: string; billingCycle: string }): number {
  const amt = parseFloat(s.amount);
  if (s.billingCycle === "quarterly") return amt / 3;
  if (s.billingCycle === "annual") return amt / 12;
  return amt; // monthly, and any unrecognized cycle (same fallback as before)
}

router.get("/revenue/summary", async (req, res): Promise<void> => {
  const activeSubs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const mrrByCurrency = groupByCurrency(activeSubs.map((s) => ({ amount: monthlyEquivalent(s).toString(), currency: s.currency })));
  const arrByCurrency = mrrByCurrency.map((m) => ({ currency: m.currency, amount: Math.round(m.amount * 12 * 100) / 100 }));

  const paidInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.status, "paid"));
  const highTicket = paidInvoices.filter((i) => parseFloat(i.amount) >= 5000);
  const highTicketTotalByCurrency = groupByCurrency(highTicket);

  const allClients = await db.select().from(clientsTable);
  const activeClientIds = new Set(activeSubs.map((s) => s.clientId).filter(Boolean));
  const dormantCount = allClients.filter((c) => c.status === "active" && !activeClientIds.has(c.id)).length;

  res.json({
    mrrByCurrency,
    arrByCurrency,
    highTicketCount: highTicket.length,
    highTicketTotalByCurrency,
    dormantCount,
    activeSubscriptions: activeSubs.length,
  });
});

router.get("/revenue/mrr-trend", async (req, res): Promise<void> => {
  const subs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const now = new Date();
  const months: { month: string; mrrByCurrency: { currency: string; amount: number }[] }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // Same snapshot-of-current-active-subs approximation as before this fix
    // (no historical subscription-amount tracking exists) — only the
    // currency-blending bug is fixed here, not the trend's own accuracy.
    const mrrByCurrency = groupByCurrency(subs.map((s) => ({ amount: monthlyEquivalent(s).toString(), currency: s.currency })));
    months.push({ month: label, mrrByCurrency });
  }
  res.json(months);
});

export default router;
