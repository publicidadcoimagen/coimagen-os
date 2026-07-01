import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, automationsTable, automationLogsTable } from "@workspace/db";
import {
  CreateAutomationBody, UpdateAutomationBody,
  UpdateAutomationParams, DeleteAutomationParams,
  GetAutomationParams, TestAutomationParams,
  ListAutomationLogsParams, CreateAutomationLogParams, CreateAutomationLogBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function ser(i: typeof automationsTable.$inferSelect) {
  return {
    ...i,
    nextRun:   i.nextRun   ? i.nextRun.toISOString()   : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt ? i.updatedAt.toISOString() : null,
  };
}

function serLog(l: typeof automationLogsTable.$inferSelect) {
  return { ...l, createdAt: l.createdAt.toISOString() };
}

// LIST
router.get("/automations", async (req, res): Promise<void> => {
  const items = await db.select().from(automationsTable).orderBy(desc(automationsTable.createdAt));
  res.json(items.map(ser));
});

// CREATE — CEO / Admin only
router.post("/automations", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [item] = await db.insert(automationsTable).values({
    name:          d.name,
    description:   d.description   ?? null,
    status:        d.status        ?? "draft",
    triggerType:   d.triggerType   ?? null,
    trigger:       d.trigger       ?? null,
    conditions:    d.conditions    ?? null,
    actionsConfig: d.actionsConfig ?? null,
    priority:      d.priority      ?? "medium",
    nextRun:       d.nextRun       ? new Date(d.nextRun) : null,
    errors:        d.errors        ?? null,
    clientId:      d.clientId      ?? null,
    projectId:     d.projectId     ?? null,
    agentId:       d.agentId       ?? null,
    workflowId:    d.workflowId    ?? null,
    integrationId: d.integrationId ?? null,
    lastRun:       d.lastRun       ?? null,
    result:        d.result        ?? null,
    notes:         d.notes         ?? null,
    platform:      d.platform      ?? null,
    action:        d.action        ?? null,
  }).returning();
  res.status(201).json(ser(item));
});

// GET ONE
router.get("/automations/:id", async (req, res): Promise<void> => {
  const params = GetAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [item] = await db.select().from(automationsTable).where(eq(automationsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(ser(item));
});

// UPDATE — CEO / Admin only
router.patch("/automations/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name          !== undefined) update.name          = d.name;
  if (d.description   !== undefined) update.description   = d.description;
  if (d.status        !== undefined) update.status        = d.status;
  if (d.triggerType   !== undefined) update.triggerType   = d.triggerType;
  if (d.trigger       !== undefined) update.trigger       = d.trigger;
  if (d.conditions    !== undefined) update.conditions    = d.conditions;
  if (d.actionsConfig !== undefined) update.actionsConfig = d.actionsConfig;
  if (d.priority      !== undefined) update.priority      = d.priority;
  if (d.nextRun       !== undefined) update.nextRun       = d.nextRun ? new Date(d.nextRun) : null;
  if (d.errors        !== undefined) update.errors        = d.errors;
  if (d.totalExecutions !== undefined) update.totalExecutions = d.totalExecutions;
  if (d.executionsToday !== undefined) update.executionsToday = d.executionsToday;
  if (d.clientId      !== undefined) update.clientId      = d.clientId;
  if (d.projectId     !== undefined) update.projectId     = d.projectId;
  if (d.agentId       !== undefined) update.agentId       = d.agentId;
  if (d.workflowId    !== undefined) update.workflowId    = d.workflowId;
  if (d.integrationId !== undefined) update.integrationId = d.integrationId;
  if (d.lastRun       !== undefined) update.lastRun       = d.lastRun;
  if (d.result        !== undefined) update.result        = d.result;
  if (d.notes         !== undefined) update.notes         = d.notes;
  if (d.platform      !== undefined) update.platform      = d.platform;
  if (d.action        !== undefined) update.action        = d.action;
  await db.update(automationsTable).set(update).where(eq(automationsTable.id, params.data.id));
  const [updated] = await db.select().from(automationsTable).where(eq(automationsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(ser(updated));
});

// DELETE — CEO / Admin only
router.delete("/automations/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(automationLogsTable).where(eq(automationLogsTable.automationId, params.data.id));
  await db.delete(automationsTable).where(eq(automationsTable.id, params.data.id));
  res.sendStatus(204);
});

// TEST MODE — CEO / Admin only
router.post("/automations/:id/test", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = TestAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [automation] = await db.select().from(automationsTable).where(eq(automationsTable.id, params.data.id));
  if (!automation) { res.status(404).json({ error: "Not found" }); return; }

  let condList: string[] = [];
  let actionList: string[] = [];
  try { condList   = JSON.parse(automation.conditions    ?? "[]"); } catch { condList = []; }
  try { actionList = JSON.parse(automation.actionsConfig ?? "[]"); } catch { actionList = []; }

  const triggerLabel = automation.triggerType ?? automation.trigger ?? "Manual";
  const conditionsEvaluated = condList.length > 0
    ? condList.map((c: string) => `✓ ${c}`)
    : ["✓ Sin condiciones — ejecuta siempre al detectar el trigger"];
  const actionsThatWouldRun = actionList.length > 0
    ? actionList.map((a: string) => `→ ${a}`)
    : ["→ Sin acciones configuradas todavía"];

  await db.insert(automationLogsTable).values({
    automationId:    params.data.id,
    trigger:         triggerLabel,
    result:          "simulated",
    actionsExecuted: JSON.stringify(actionList),
    errors:          null,
    durationMs:      Math.floor(Math.random() * 200) + 50,
    isTest:          true,
    userId:          null,
    clientId:        automation.clientId  ?? null,
    projectId:       automation.projectId ?? null,
  });

  res.json({
    triggerDetected: `${triggerLabel} — detectado correctamente`,
    conditionsEvaluated,
    actionsThatWouldRun,
    simulatedResult: automation.status === "active"
      ? "✅ Activa. Se ejecutaría en producción si se detecta el trigger real."
      : `⚠️ Estado "${automation.status}". Actívala para ejecución en producción.`,
    notes: "Modo de prueba — ningún dato real fue modificado.",
  });
});

// LOGS LIST
router.get("/automations/:id/logs", async (req, res): Promise<void> => {
  const params = ListAutomationLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const logs = await db.select().from(automationLogsTable)
    .where(eq(automationLogsTable.automationId, params.data.id))
    .orderBy(desc(automationLogsTable.createdAt));
  res.json(logs.map(serLog));
});

// LOG CREATE
router.post("/automations/:id/logs", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = CreateAutomationLogParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = CreateAutomationLogBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [log] = await db.insert(automationLogsTable).values({
    automationId:    params.data.id,
    trigger:         d.trigger         ?? null,
    result:          d.result          ?? "success",
    actionsExecuted: d.actionsExecuted ?? null,
    errors:          d.errors          ?? null,
    durationMs:      d.durationMs      ?? null,
    isTest:          d.isTest          ?? false,
    userId:          d.userId          ?? null,
    clientId:        d.clientId        ?? null,
    projectId:       d.projectId       ?? null,
  }).returning();
  res.status(201).json(serLog(log));
});

export default router;
