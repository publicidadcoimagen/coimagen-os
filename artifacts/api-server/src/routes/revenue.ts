import { Router, type IRouter } from "express";
import { db, subscriptionsTable, invoicesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { groupByCurrency, mrrByCurrency as toMrrByCurrency, annualize } from "../lib/currency-aggregates";

const router: IRouter = Router();

// Every money aggregate is grouped per currency, never summed across MXN/USD
// — see lib/currency-aggregates.ts (shared with dashboard.ts).

router.get("/revenue/summary", async (req, res): Promise<void> => {
  const activeSubs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const mrrByCurrency = toMrrByCurrency(activeSubs);
  const arrByCurrency = annualize(mrrByCurrency);

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
    const mrrByCurrency = toMrrByCurrency(subs);
    months.push({ month: label, mrrByCurrency });
  }
  res.json(months);
});

export default router;
