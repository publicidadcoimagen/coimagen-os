import { Router, type IRouter } from "express";
import { db, subscriptionsTable, invoicesTable, clientsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/revenue/summary", async (req, res): Promise<void> => {
  const activeSubs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const mrr = activeSubs.reduce((sum, s) => {
    const amt = parseFloat(s.amount);
    if (s.billingCycle === "monthly") return sum + amt;
    if (s.billingCycle === "quarterly") return sum + amt / 3;
    if (s.billingCycle === "annual") return sum + amt / 12;
    return sum;
  }, 0);

  const paidInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.status, "paid"));
  const highTicket = paidInvoices.filter((i) => parseFloat(i.amount) >= 5000);
  const highTicketTotal = highTicket.reduce((s, i) => s + parseFloat(i.amount), 0);

  const allClients = await db.select().from(clientsTable);
  const activeClientIds = new Set(activeSubs.map((s) => s.clientId).filter(Boolean));
  const dormantCount = allClients.filter((c) => c.status === "active" && !activeClientIds.has(c.id)).length;

  res.json({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    highTicketCount: highTicket.length,
    highTicketTotal: Math.round(highTicketTotal * 100) / 100,
    dormantCount,
    activeSubscriptions: activeSubs.length,
  });
});

router.get("/revenue/mrr-trend", async (req, res): Promise<void> => {
  const subs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const now = new Date();
  const months: { month: string; mrr: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mrr = subs.reduce((sum, s) => {
      const amt = parseFloat(s.amount);
      if (s.billingCycle === "monthly") return sum + amt;
      if (s.billingCycle === "quarterly") return sum + amt / 3;
      if (s.billingCycle === "annual") return sum + amt / 12;
      return sum;
    }, 0);
    months.push({ month: label, mrr: Math.round(mrr * 100) / 100 });
  }
  res.json(months);
});

export default router;
