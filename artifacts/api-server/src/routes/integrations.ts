import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, integrationsTable, integrationLogsTable } from "@workspace/db";
import {
  ListIntegrationsQueryParams,
  CreateIntegrationBody,
  GetIntegrationParams,
  UpdateIntegrationParams,
  UpdateIntegrationBody,
  DeleteIntegrationParams,
  ListIntegrationLogsParams,
  CreateIntegrationLogParams,
  CreateIntegrationLogBody,
  TestIntegrationParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeIntegration(r: typeof integrationsTable.$inferSelect) {
  return {
    ...r,
    lastSync:  r.lastSync  ? r.lastSync.toISOString()  : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

function serializeLog(r: typeof integrationLogsTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

async function addLog(integrationId: number, action: string, message?: string) {
  await db.insert(integrationLogsTable).values({ integrationId, action, message: message ?? null });
}

// LIST
router.get("/integrations", async (req, res): Promise<void> => {
  const q = ListIntegrationsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  let query = db.select().from(integrationsTable).$dynamic();
  const conds = [];
  if (q.data.status) conds.push(eq(integrationsTable.status, q.data.status));
  if (q.data.type)   conds.push(eq(integrationsTable.type,   q.data.type));
  if (conds.length)  query = query.where(and(...conds));
  const rows = await query.orderBy(desc(integrationsTable.createdAt));
  res.json(rows.map(serializeIntegration));
});

// CREATE — CEO / Admin only
router.post("/integrations", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateIntegrationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [row] = await db.insert(integrationsTable).values({
    name:                d.name,
    platform:            d.platform,
    description:         d.description         ?? null,
    status:              d.status              ?? "not_configured",
    type:                d.type,
    credentialsRequired: d.credentialsRequired ?? null,
    envVars:             d.envVars             ?? null,
    responsibleId:       d.responsibleId       ?? null,
    clientId:            d.clientId            ?? null,
    projectId:           d.projectId           ?? null,
    agentId:             d.agentId             ?? null,
    notes:               d.notes               ?? null,
  }).returning();
  await addLog(row.id, "configured", `Integración "${d.name}" creada`);
  res.status(201).json(serializeIntegration(row));
});

// GET ONE
router.get("/integrations/:id", async (req, res): Promise<void> => {
  const params = GetIntegrationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(integrationsTable).where(eq(integrationsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeIntegration(row));
});

// UPDATE — CEO / Admin only
router.patch("/integrations/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateIntegrationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateIntegrationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name                !== undefined) update.name                = d.name;
  if (d.platform            !== undefined) update.platform            = d.platform;
  if (d.description         !== undefined) update.description         = d.description;
  if (d.status              !== undefined) update.status              = d.status;
  if (d.type                !== undefined) update.type                = d.type;
  if (d.credentialsRequired !== undefined) update.credentialsRequired = d.credentialsRequired;
  if (d.envVars             !== undefined) update.envVars             = d.envVars;
  if (d.responsibleId       !== undefined) update.responsibleId       = d.responsibleId;
  if (d.clientId            !== undefined) update.clientId            = d.clientId;
  if (d.projectId           !== undefined) update.projectId           = d.projectId;
  if (d.agentId             !== undefined) update.agentId             = d.agentId;
  if (d.notes               !== undefined) update.notes               = d.notes;
  if (d.errors              !== undefined) update.errors              = d.errors;
  await db.update(integrationsTable).set(update).where(eq(integrationsTable.id, params.data.id));
  const [updated] = await db.select().from(integrationsTable).where(eq(integrationsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  if (d.status) await addLog(params.data.id, d.status === "active" ? "activated" : d.status === "paused" ? "paused" : d.status === "error" ? "error" : "configured", `Estado cambiado a "${d.status}"`);
  res.json(serializeIntegration(updated));
});

// DELETE — CEO / Admin only
router.delete("/integrations/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteIntegrationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(integrationLogsTable).where(eq(integrationLogsTable.integrationId, params.data.id));
  await db.delete(integrationsTable).where(eq(integrationsTable.id, params.data.id));
  res.sendStatus(204);
});

// LOGS LIST
router.get("/integrations/:id/logs", async (req, res): Promise<void> => {
  const params = ListIntegrationLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const logs = await db.select().from(integrationLogsTable)
    .where(eq(integrationLogsTable.integrationId, params.data.id))
    .orderBy(desc(integrationLogsTable.createdAt));
  res.json(logs.map(serializeLog));
});

// LOG CREATE
router.post("/integrations/:id/logs", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = CreateIntegrationLogParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = CreateIntegrationLogBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [log] = await db.insert(integrationLogsTable).values({
    integrationId: params.data.id,
    action: body.data.action,
    message: body.data.message ?? null,
  }).returning();
  res.status(201).json(serializeLog(log));
});

// TEST CONNECTION
router.post("/integrations/:id/test", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = TestIntegrationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [integration] = await db.select().from(integrationsTable).where(eq(integrationsTable.id, params.data.id));
  if (!integration) { res.status(404).json({ error: "Not found" }); return; }
  await addLog(params.data.id, "tested", "Prueba de conexión ejecutada");
  res.json({
    success: false,
    message: "Credenciales pendientes. Agrega las variables de entorno requeridas para activar esta integración.",
  });
});

export default router;
