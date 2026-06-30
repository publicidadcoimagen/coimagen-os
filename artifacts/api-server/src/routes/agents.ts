import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  agentsTable,
  agentPromptVersionsTable,
  agentClientsTable,
  agentProjectsTable,
  mundosTable,
  directorsTable,
  clientsTable,
  projectsTable,
} from "@workspace/db";
import {
  GetAgentParams,
  UpdateAgentParams,
  UpdateAgentBody,
  DeleteAgentParams,
  CreateAgentBody,
  ListAgentPromptVersionsParams,
  CreateAgentPromptVersionParams,
  CreateAgentPromptVersionBody,
  AssignAgentClientParams,
  AssignAgentClientBody,
  UnassignAgentClientParams,
  AssignAgentProjectParams,
  AssignAgentProjectBody,
  UnassignAgentProjectParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAgent(a: typeof agentsTable.$inferSelect) {
  return {
    ...a,
    lastActivity: a.lastActivity ? a.lastActivity.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt ? a.updatedAt.toISOString() : null,
  };
}

async function getAgentFull(agentId: number) {
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return null;

  const [mundoRow] = agent.mundoId
    ? await db.select({ name: mundosTable.name }).from(mundosTable).where(eq(mundosTable.id, agent.mundoId))
    : [null];

  const [directorRow] = agent.directorId
    ? await db.select({ name: directorsTable.name }).from(directorsTable).where(eq(directorsTable.id, agent.directorId))
    : [null];

  const assignedClients = await db
    .select({ id: clientsTable.id, name: clientsTable.name })
    .from(agentClientsTable)
    .innerJoin(clientsTable, eq(agentClientsTable.clientId, clientsTable.id))
    .where(eq(agentClientsTable.agentId, agentId));

  const assignedProjects = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(agentProjectsTable)
    .innerJoin(projectsTable, eq(agentProjectsTable.projectId, projectsTable.id))
    .where(eq(agentProjectsTable.agentId, agentId));

  const promptVersions = await db
    .select()
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.agentId, agentId))
    .orderBy(desc(agentPromptVersionsTable.version));

  return {
    ...serializeAgent(agent),
    mundoName: mundoRow?.name ?? null,
    directorName: directorRow?.name ?? null,
    assignedClients,
    assignedProjects,
    promptVersions: promptVersions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

router.get("/agents", async (req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);

  const mundoIds = [...new Set(agents.map((a) => a.mundoId).filter(Boolean))] as number[];
  const directorIds = [...new Set(agents.map((a) => a.directorId).filter(Boolean))] as number[];

  const mundos = mundoIds.length > 0
    ? await db.select({ id: mundosTable.id, name: mundosTable.name }).from(mundosTable)
    : [];
  const directors = directorIds.length > 0
    ? await db.select({ id: directorsTable.id, name: directorsTable.name }).from(directorsTable)
    : [];

  const mundoMap = new Map(mundos.map((m) => [m.id, m.name]));
  const directorMap = new Map(directors.map((d) => [d.id, d.name]));

  res.json(agents.map((a) => ({
    ...serializeAgent(a),
    mundoName: a.mundoId ? (mundoMap.get(a.mundoId) ?? null) : null,
    directorName: a.directorId ? (directorMap.get(a.directorId) ?? null) : null,
    assignedClients: [],
    assignedProjects: [],
    promptVersions: [],
  })));
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertData: Record<string, unknown> = {
    name: parsed.data.name,
    role: parsed.data.role,
    category: parsed.data.category ?? null,
    world: parsed.data.world ?? null,
    mundoId: parsed.data.mundoId ?? null,
    directorId: parsed.data.directorId ?? null,
    specialty: parsed.data.specialty ?? null,
    objetivo: parsed.data.objetivo ?? null,
    status: parsed.data.status ?? "active",
    priority: parsed.data.priority ?? "medium",
    aiModel: parsed.data.aiModel ?? null,
    description: parsed.data.description ?? null,
    promptMaster: parsed.data.promptMaster ?? null,
    inputs: parsed.data.inputs ?? null,
    outputs: parsed.data.outputs ?? null,
    toolsList: parsed.data.toolsList ?? [],
    kpisList: parsed.data.kpisList ?? [],
    documentation: parsed.data.documentation ?? null,
    dependencies: parsed.data.dependencies ?? [],
  };

  const [agent] = await db.insert(agentsTable).values(insertData as typeof agentsTable.$inferInsert).returning();
  const full = await getAgentFull(agent.id);
  res.status(201).json(full);
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const agent = await getAgentFull(params.data.id);
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  res.json(agent);
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.role !== undefined) updateData.role = d.role;
  if (d.category !== undefined) updateData.category = d.category;
  if (d.world !== undefined) updateData.world = d.world;
  if (d.mundoId !== undefined) updateData.mundoId = d.mundoId;
  if (d.directorId !== undefined) updateData.directorId = d.directorId;
  if (d.specialty !== undefined) updateData.specialty = d.specialty;
  if (d.objetivo !== undefined) updateData.objetivo = d.objetivo;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.priority !== undefined) updateData.priority = d.priority;
  if (d.aiModel !== undefined) updateData.aiModel = d.aiModel;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.promptMaster !== undefined) updateData.promptMaster = d.promptMaster;
  if (d.inputs !== undefined) updateData.inputs = d.inputs;
  if (d.outputs !== undefined) updateData.outputs = d.outputs;
  if (d.toolsList !== undefined) updateData.toolsList = d.toolsList;
  if (d.kpisList !== undefined) updateData.kpisList = d.kpisList;
  if (d.documentation !== undefined) updateData.documentation = d.documentation;
  if (d.dependencies !== undefined) updateData.dependencies = d.dependencies;

  await db.update(agentsTable).set(updateData).where(eq(agentsTable.id, params.data.id));
  const agent = await getAgentFull(params.data.id);
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  res.json(agent);
});

router.delete("/agents/:id", async (req, res): Promise<void> => {
  const params = DeleteAgentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [agent] = await db.delete(agentsTable).where(eq(agentsTable.id, params.data.id)).returning();
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  res.sendStatus(204);
});

router.get("/agents/:id/prompt-versions", async (req, res): Promise<void> => {
  const params = ListAgentPromptVersionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const versions = await db
    .select()
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.agentId, params.data.id))
    .orderBy(desc(agentPromptVersionsTable.version));
  res.json(versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })));
});

router.post("/agents/:id/prompt-versions", async (req, res): Promise<void> => {
  const params = CreateAgentPromptVersionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateAgentPromptVersionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [latest] = await db
    .select({ version: agentPromptVersionsTable.version })
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.agentId, params.data.id))
    .orderBy(desc(agentPromptVersionsTable.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;
  const [newVersion] = await db.insert(agentPromptVersionsTable).values({
    agentId: params.data.id,
    promptText: parsed.data.promptText,
    version: nextVersion,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json({ ...newVersion, createdAt: newVersion.createdAt.toISOString() });
});

router.post("/agents/:id/clients", async (req, res): Promise<void> => {
  const params = AssignAgentClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AssignAgentClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(agentClientsTable).values({ agentId: params.data.id, clientId: parsed.data.clientId }).onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/agents/:id/clients/:clientId", async (req, res): Promise<void> => {
  const params = UnassignAgentClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(agentClientsTable)
    .where(eq(agentClientsTable.agentId, params.data.id));
  res.sendStatus(204);
});

router.post("/agents/:id/projects", async (req, res): Promise<void> => {
  const params = AssignAgentProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AssignAgentProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(agentProjectsTable).values({ agentId: params.data.id, projectId: parsed.data.projectId }).onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/agents/:id/projects/:projectId", async (req, res): Promise<void> => {
  const params = UnassignAgentProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(agentProjectsTable)
    .where(eq(agentProjectsTable.agentId, params.data.id));
  res.sendStatus(204);
});

export default router;
