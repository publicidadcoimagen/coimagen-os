import { Router, type IRouter } from "express";
import {
  db, clientsTable, projectsTable, agentsTable, tasksTable,
  subscriptionsTable, approvalsTable, invoicesTable, costsTable,
} from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { mrrByCurrency as toMrrByCurrency, annualize, usdMarginPercent } from "../lib/currency-aggregates";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = now.toISOString().split("T")[0];
  const in7DaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [[totalClients], [activeClients], [suspendedClients],
    [activeProjects], [openTasks], [overdueTasks],
    [completedThisMonth], [totalAgents], [pendingApprovals],
    subs, monthCosts, [overdueInvoices], upcomingInvoices] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(clientsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(clientsTable).where(eq(clientsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(clientsTable).where(eq(clientsTable.status, "suspended")),
    db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(sql`${tasksTable.status} IN ('todo','in_progress','review')`),
    db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(sql`${tasksTable.status} IN ('todo','in_progress') AND ${tasksTable.dueDate} < ${todayStr}`),
    db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(sql`${projectsTable.status} = 'completed' AND ${projectsTable.updatedAt} >= ${startOfMonth}`),
    db.select({ count: sql<number>`count(*)::int` }).from(agentsTable).where(eq(agentsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(approvalsTable).where(sql`${approvalsTable.status} IN ('draft','pending')`),
    db.select({ amount: subscriptionsTable.amount, billingCycle: subscriptionsTable.billingCycle, currency: subscriptionsTable.currency }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
    db.select({ amount: costsTable.amount }).from(costsTable).where(eq(costsTable.month, currentMonth)),
    db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable).where(sql`${invoicesTable.status} = 'overdue' OR (${invoicesTable.status} = 'sent' AND ${invoicesTable.dueDate} < ${todayStr})`),
    db.select({ amount: invoicesTable.amount, dueDate: invoicesTable.dueDate, number: invoicesTable.number }).from(invoicesTable).where(sql`${invoicesTable.status} = 'sent' AND ${invoicesTable.dueDate} >= ${todayStr} AND ${invoicesTable.dueDate} <= ${in7DaysStr}`),
  ]);

  // Per currency, monthly-equivalent — same math as /revenue/summary (the
  // old blended `mrr` summed MXN + USD and counted annual plans as monthly).
  const mrrByCurrency = toMrrByCurrency(subs);
  const arrByCurrency = annualize(mrrByCurrency);
  const totalCostsThisMonth = monthCosts.reduce((sum, c) => sum + parseFloat(String(c.amount ?? "0")), 0);
  const marginThisMonth = usdMarginPercent(mrrByCurrency, totalCostsThisMonth);

  res.json({
    totalClients: totalClients?.count ?? 0,
    activeClients: activeClients?.count ?? 0,
    suspendedClients: suspendedClients?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    openTasks: openTasks?.count ?? 0,
    overdueTasks: overdueTasks?.count ?? 0,
    completedProjectsThisMonth: completedThisMonth?.count ?? 0,
    totalAgents: totalAgents?.count ?? 0,
    pendingApprovals: pendingApprovals?.count ?? 0,
    mrrByCurrency,
    arrByCurrency,
    totalCostsThisMonth,
    marginThisMonth,
    overdueInvoices: overdueInvoices?.count ?? 0,
    upcomingPayments: upcomingInvoices.length,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const recentClients = await db.select().from(clientsTable).orderBy(sql`${clientsTable.createdAt} DESC`).limit(3);
  const recentProjects = await db.select().from(projectsTable).orderBy(sql`${projectsTable.createdAt} DESC`).limit(3);
  const recentTasks = await db.select().from(tasksTable).where(eq(tasksTable.status, "done")).orderBy(sql`${tasksTable.updatedAt} DESC`).limit(3);

  const entries = [
    ...recentClients.map((c, i) => ({
      id: i + 1,
      type: "client_added" as const,
      description: `Cliente añadido: ${c.name}`,
      entityName: c.name,
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentProjects.map((p, i) => ({
      id: recentClients.length + i + 1,
      type: "project_created" as const,
      description: `Proyecto creado: ${p.name}`,
      entityName: p.name,
      createdAt: p.createdAt.toISOString(),
    })),
    ...recentTasks.map((t, i) => ({
      id: recentClients.length + recentProjects.length + i + 1,
      type: "task_done" as const,
      description: `Tarea completada: ${t.title}`,
      entityName: t.title,
      createdAt: (t.updatedAt ?? t.createdAt).toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  res.json(entries);
});

router.get("/dashboard/projects-by-status", async (req, res): Promise<void> => {
  const rows = await db.select({
    status: projectsTable.status,
    count: sql<number>`count(*)::int`,
  }).from(projectsTable).groupBy(projectsTable.status);
  res.json(rows);
});

export default router;
