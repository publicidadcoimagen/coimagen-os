import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, orchestrationRulesTable } from "@workspace/db";
import {
  ListOrchestrationRulesQueryParams,
  CreateOrchestrationRuleBody,
  GetOrchestrationRuleParams,
  UpdateOrchestrationRuleParams,
  UpdateOrchestrationRuleBody,
  DeleteOrchestrationRuleParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(r: typeof orchestrationRulesTable.$inferSelect) {
  return {
    ...r,
    createdAt:      r.createdAt.toISOString(),
    updatedAt:      r.updatedAt      ? r.updatedAt.toISOString()      : null,
    lastExecutedAt: r.lastExecutedAt ? r.lastExecutedAt.toISOString() : null,
  };
}

router.get("/orchestration-rules", async (req, res): Promise<void> => {
  const q = ListOrchestrationRulesQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  let query = db.select().from(orchestrationRulesTable).$dynamic();
  const conds = [];
  if (q.data.status)       conds.push(eq(orchestrationRulesTable.status, q.data.status));
  if (q.data.triggerEvent) conds.push(eq(orchestrationRulesTable.triggerEvent, q.data.triggerEvent));
  if (conds.length > 0) query = query.where(and(...conds));
  const rows = await query.orderBy(desc(orchestrationRulesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/orchestration-rules", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateOrchestrationRuleBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [row] = await db.insert(orchestrationRulesTable).values({
    name:         d.name,
    description:  d.description ?? null,
    triggerEvent: d.triggerEvent,
    condition:    d.condition ?? null,
    actions:      d.actions ?? null,
    status:       d.status ?? "active",
    executionCount: 0,
  }).returning();
  res.status(201).json(serialize(row));
});

router.get("/orchestration-rules/:id", async (req, res): Promise<void> => {
  const params = GetOrchestrationRuleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(orchestrationRulesTable).where(eq(orchestrationRulesTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/orchestration-rules/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateOrchestrationRuleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateOrchestrationRuleBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name         !== undefined) update.name         = d.name;
  if (d.description  !== undefined) update.description  = d.description;
  if (d.triggerEvent !== undefined) update.triggerEvent = d.triggerEvent;
  if (d.condition    !== undefined) update.condition    = d.condition;
  if (d.actions      !== undefined) update.actions      = d.actions;
  if (d.status       !== undefined) update.status       = d.status;
  await db.update(orchestrationRulesTable).set(update).where(eq(orchestrationRulesTable.id, params.data.id));
  const [updated] = await db.select().from(orchestrationRulesTable).where(eq(orchestrationRulesTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/orchestration-rules/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteOrchestrationRuleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(orchestrationRulesTable).where(eq(orchestrationRulesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
