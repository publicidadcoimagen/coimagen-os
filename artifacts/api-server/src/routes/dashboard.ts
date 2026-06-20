import { Router, type IRouter } from "express";
import { db, clientsTable, projectsTable, agentsTable, tasksTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalClients] = await db.select({ count: sql<number>`count(*)::int` }).from(clientsTable);
  const [activeProjects] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active"));
  const [totalAgents] = await db.select({ count: sql<number>`count(*)::int` }).from(agentsTable).where(eq(agentsTable.status, "active"));
  const [openTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(sql`${tasksTable.status} IN ('todo', 'in_progress', 'review')`);
  const [completedThisMonth] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(sql`${projectsTable.status} = 'completed' AND ${projectsTable.updatedAt} >= ${startOfMonth}`);
  const [activeClientsThisMonth] = await db.select({ count: sql<number>`count(*)::int` }).from(clientsTable).where(eq(clientsTable.status, "active"));

  res.json({
    totalClients: totalClients?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    totalAgents: totalAgents?.count ?? 0,
    openTasks: openTasks?.count ?? 0,
    completedProjectsThisMonth: completedThisMonth?.count ?? 0,
    activeClientsThisMonth: activeClientsThisMonth?.count ?? 0,
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
      description: `New client added: ${c.name}`,
      entityName: c.name,
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentProjects.map((p, i) => ({
      id: recentClients.length + i + 1,
      type: "project_created" as const,
      description: `Project created: ${p.name}`,
      entityName: p.name,
      createdAt: p.createdAt.toISOString(),
    })),
    ...recentTasks.map((t, i) => ({
      id: recentClients.length + recentProjects.length + i + 1,
      type: "task_done" as const,
      description: `Task completed: ${t.title}`,
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
