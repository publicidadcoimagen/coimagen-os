import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, projectsTable, agentsTable } from "@workspace/db";
import {
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  CreateTaskBody,
  ListTasksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);

  const rows = await db.select({
    id: tasksTable.id,
    title: tasksTable.title,
    description: tasksTable.description,
    projectId: tasksTable.projectId,
    projectName: projectsTable.name,
    agentId: tasksTable.agentId,
    agentName: agentsTable.name,
    status: tasksTable.status,
    priority: tasksTable.priority,
    dueDate: tasksTable.dueDate,
    createdAt: tasksTable.createdAt,
    updatedAt: tasksTable.updatedAt,
  })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .orderBy(tasksTable.createdAt);

  let filtered = rows;
  if (qp.success && qp.data.projectId) {
    filtered = filtered.filter((t) => t.projectId === qp.data.projectId);
  }
  if (qp.success && qp.data.agentId) {
    filtered = filtered.filter((t) => t.agentId === qp.data.agentId);
  }
  if (qp.success && qp.data.status) {
    filtered = filtered.filter((t) => t.status === qp.data.status);
  }

  res.json(filtered.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
  })));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    projectId: parsed.data.projectId ?? null,
    agentId: parsed.data.agentId ?? null,
    status: parsed.data.status ?? "todo",
    priority: parsed.data.priority ?? "medium",
    dueDate: parsed.data.dueDate ?? null,
  }).returning();

  let projectName: string | null = null;
  let agentName: string | null = null;
  if (task.projectId) {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, task.projectId));
    projectName = p?.name ?? null;
  }
  if (task.agentId) {
    const [a] = await db.select().from(agentsTable).where(eq(agentsTable.id, task.agentId));
    agentName = a?.name ?? null;
  }

  res.status(201).json({
    ...task,
    projectName,
    agentName,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
  });
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select({
    id: tasksTable.id,
    title: tasksTable.title,
    description: tasksTable.description,
    projectId: tasksTable.projectId,
    projectName: projectsTable.name,
    agentId: tasksTable.agentId,
    agentName: agentsTable.name,
    status: tasksTable.status,
    priority: tasksTable.priority,
    dueDate: tasksTable.dueDate,
    createdAt: tasksTable.createdAt,
    updatedAt: tasksTable.updatedAt,
  })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .where(eq(tasksTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  });
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.update(tasksTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let projectName: string | null = null;
  let agentName: string | null = null;
  if (task.projectId) {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, task.projectId));
    projectName = p?.name ?? null;
  }
  if (task.agentId) {
    const [a] = await db.select().from(agentsTable).where(eq(agentsTable.id, task.agentId));
    agentName = a?.name ?? null;
  }

  res.json({
    ...task,
    projectName,
    agentName,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
  });
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
