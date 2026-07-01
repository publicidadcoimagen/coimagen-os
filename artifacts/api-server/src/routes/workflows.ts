import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, workflowsTable, workflowStageLogsTable } from "@workspace/db";
import {
  ListWorkflowsQueryParams,
  CreateWorkflowBody,
  GetWorkflowParams,
  UpdateWorkflowParams,
  UpdateWorkflowBody,
  DeleteWorkflowParams,
  AdvanceWorkflowParams,
  AdvanceWorkflowBody,
  GetWorkflowStageLogsParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ALL_STAGES = [
  "lead_received", "diagnosis_started", "diagnosis_completed",
  "proposal_sent", "proposal_approved", "contract_sent", "contract_signed",
  "payment_received", "onboarding_started", "onboarding_completed",
  "production_started", "design_review", "development_review",
  "qa_internal", "changes_requested", "client_approval",
  "final_delivery", "monthly_active", "support_active", "customer_success",
];

function stageProgress(stage: string): number {
  const idx = ALL_STAGES.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round((idx / (ALL_STAGES.length - 1)) * 100);
}

function serialize(w: typeof workflowsTable.$inferSelect) {
  return {
    ...w,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt ? w.updatedAt.toISOString() : null,
  };
}

router.get("/workflows", async (req, res): Promise<void> => {
  const q = ListWorkflowsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  let query = db.select().from(workflowsTable).$dynamic();
  const conditions = [];
  if (q.data.status) conditions.push(eq(workflowsTable.status, q.data.status));
  if (q.data.clientId) conditions.push(eq(workflowsTable.clientId, q.data.clientId));
  if (q.data.product) conditions.push(eq(workflowsTable.product, q.data.product));
  if (q.data.stage) conditions.push(eq(workflowsTable.currentStage, q.data.stage));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(desc(workflowsTable.updatedAt));
  res.json(rows.map(serialize));
});

router.post("/workflows", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateWorkflowBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const stage = d.currentStage ?? "lead_received";
  const [wf] = await db.insert(workflowsTable).values({
    name: d.name,
    description: d.description ?? null,
    product: d.product ?? null,
    clientId: d.clientId ?? null,
    projectId: d.projectId ?? null,
    priority: d.priority ?? "medium",
    currentStage: stage,
    progress: stageProgress(stage),
    responsibleId: d.responsibleId ?? null,
    agentIds: (d.agentIds as number[] | undefined) ?? null,
    startDate: d.startDate ?? null,
    targetDate: d.targetDate ?? null,
    notes: d.notes ?? null,
    templateId: d.templateId ?? null,
    status: "active",
  }).returning();

  await db.insert(workflowStageLogsTable).values({
    workflowId: wf.id,
    fromStage: null,
    toStage: stage,
    note: "Workflow creado",
    userId: (req as { user?: { id?: string } }).user?.id ?? null,
  });

  res.status(201).json(serialize(wf));
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const params = GetWorkflowParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  if (!wf) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(wf));
});

router.patch("/workflows/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateWorkflowParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateWorkflowBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [existing] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.product !== undefined) update.product = d.product;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.projectId !== undefined) update.projectId = d.projectId;
  if (d.status !== undefined) update.status = d.status;
  if (d.priority !== undefined) update.priority = d.priority;
  if (d.responsibleId !== undefined) update.responsibleId = d.responsibleId;
  if (d.agentIds !== undefined) update.agentIds = d.agentIds;
  if (d.startDate !== undefined) update.startDate = d.startDate;
  if (d.targetDate !== undefined) update.targetDate = d.targetDate;
  if (d.notes !== undefined) update.notes = d.notes;
  if (d.blockers !== undefined) update.blockers = d.blockers;
  if (d.templateId !== undefined) update.templateId = d.templateId;

  if (d.currentStage !== undefined && d.currentStage !== existing.currentStage) {
    update.currentStage = d.currentStage;
    update.progress = stageProgress(d.currentStage);
    await db.insert(workflowStageLogsTable).values({
      workflowId: params.data.id,
      fromStage: existing.currentStage,
      toStage: d.currentStage,
      note: "Etapa actualizada",
      userId: (req as { user?: { id?: string } }).user?.id ?? null,
    });
  }
  if (d.progress !== undefined) update.progress = d.progress;

  await db.update(workflowsTable).set(update).where(eq(workflowsTable.id, params.data.id));
  const [updated] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  res.json(serialize(updated));
});

router.delete("/workflows/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteWorkflowParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/workflows/:id/advance", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = AdvanceWorkflowParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = AdvanceWorkflowBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [existing] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let toStage = body.data.stage;
  if (!toStage) {
    const idx = ALL_STAGES.indexOf(existing.currentStage);
    toStage = idx < ALL_STAGES.length - 1 ? ALL_STAGES[idx + 1] : existing.currentStage;
  }

  const progress = stageProgress(toStage);
  const isCompleted = toStage === "customer_success";

  await db.update(workflowsTable).set({
    currentStage: toStage,
    progress,
    status: isCompleted ? "completed" : "active",
    updatedAt: new Date(),
  }).where(eq(workflowsTable.id, params.data.id));

  await db.insert(workflowStageLogsTable).values({
    workflowId: params.data.id,
    fromStage: existing.currentStage,
    toStage,
    note: body.data.note ?? null,
    userId: (req as { user?: { id?: string } }).user?.id ?? null,
  });

  const [updated] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  res.json(serialize(updated));
});

router.get("/workflows/:id/stage-logs", async (req, res): Promise<void> => {
  const params = GetWorkflowStageLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const logs = await db.select().from(workflowStageLogsTable)
    .where(eq(workflowStageLogsTable.workflowId, params.data.id))
    .orderBy(desc(workflowStageLogsTable.createdAt));
  res.json(logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

export default router;
