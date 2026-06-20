import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, clientsTable } from "@workspace/db";
import {
  GetProjectParams,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  CreateProjectBody,
  ListProjectsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const qp = ListProjectsQueryParams.safeParse(req.query);
  const projects = await db.select({
    id: projectsTable.id,
    name: projectsTable.name,
    description: projectsTable.description,
    clientId: projectsTable.clientId,
    clientName: clientsTable.name,
    status: projectsTable.status,
    priority: projectsTable.priority,
    dueDate: projectsTable.dueDate,
    budget: projectsTable.budget,
    createdAt: projectsTable.createdAt,
    updatedAt: projectsTable.updatedAt,
  })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .orderBy(projectsTable.createdAt);

  let filtered = projects;
  if (qp.success && qp.data.clientId) {
    filtered = filtered.filter((p) => p.clientId === qp.data.clientId);
  }
  if (qp.success && qp.data.status) {
    filtered = filtered.filter((p) => p.status === qp.data.status);
  }

  res.json(filtered.map((p) => ({
    ...p,
    budget: p.budget !== null ? parseFloat(p.budget) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  })));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    clientId: parsed.data.clientId ?? null,
    status: parsed.data.status ?? "planning",
    priority: parsed.data.priority ?? "medium",
    dueDate: parsed.data.dueDate ?? null,
    budget: parsed.data.budget?.toString() ?? null,
  }).returning();

  let clientName: string | null = null;
  if (project.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId));
    clientName = client?.name ?? null;
  }

  res.status(201).json({
    ...project,
    clientName,
    budget: project.budget !== null ? parseFloat(project.budget) : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
  });
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select({
    id: projectsTable.id,
    name: projectsTable.name,
    description: projectsTable.description,
    clientId: projectsTable.clientId,
    clientName: clientsTable.name,
    status: projectsTable.status,
    priority: projectsTable.priority,
    dueDate: projectsTable.dueDate,
    budget: projectsTable.budget,
    createdAt: projectsTable.createdAt,
    updatedAt: projectsTable.updatedAt,
  })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .where(eq(projectsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({
    ...row,
    budget: row.budget !== null ? parseFloat(row.budget) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  });
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.budget !== undefined) {
    updateData.budget = parsed.data.budget.toString();
  }
  const [project] = await db.update(projectsTable)
    .set(updateData)
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let clientName: string | null = null;
  if (project.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId));
    clientName = client?.name ?? null;
  }

  res.json({
    ...project,
    clientName,
    budget: project.budget !== null ? parseFloat(project.budget) : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
  });
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
