import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, orchestrationEventsTable } from "@workspace/db";
import {
  ListOrchestrationEventsQueryParams,
  CreateOrchestrationEventBody,
  GetOrchestrationEventParams,
  UpdateOrchestrationEventParams,
  UpdateOrchestrationEventBody,
  DeleteOrchestrationEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(r: typeof orchestrationEventsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    lastExecutedAt: null,
  };
}

router.get("/orchestration-events", async (req, res): Promise<void> => {
  const q = ListOrchestrationEventsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  let query = db.select().from(orchestrationEventsTable).$dynamic();
  const conds = [];
  if (q.data.status)    conds.push(eq(orchestrationEventsTable.status, q.data.status));
  if (q.data.source)    conds.push(eq(orchestrationEventsTable.source, q.data.source));
  if (q.data.eventType) conds.push(eq(orchestrationEventsTable.eventType, q.data.eventType));
  if (q.data.clientId)  conds.push(eq(orchestrationEventsTable.clientId, q.data.clientId));
  if (q.data.priority)  conds.push(eq(orchestrationEventsTable.priority, q.data.priority));
  if (conds.length > 0) query = query.where(and(...conds));
  const rows = await query.orderBy(desc(orchestrationEventsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/orchestration-events", async (req, res): Promise<void> => {
  const body = CreateOrchestrationEventBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [row] = await db.insert(orchestrationEventsTable).values({
    eventType:   d.eventType,
    source:      d.source,
    destination: d.destination ?? null,
    priority:    d.priority ?? "normal",
    status:      d.status ?? "pending",
    clientId:    d.clientId ?? null,
    projectId:   d.projectId ?? null,
    userId:      d.userId ?? null,
    notes:       d.notes ?? null,
  }).returning();
  res.status(201).json(serialize(row));
});

router.get("/orchestration-events/:id", async (req, res): Promise<void> => {
  const params = GetOrchestrationEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(orchestrationEventsTable).where(eq(orchestrationEventsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/orchestration-events/:id", async (req, res): Promise<void> => {
  const params = UpdateOrchestrationEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateOrchestrationEventBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.eventType   !== undefined) update.eventType   = d.eventType;
  if (d.source      !== undefined) update.source      = d.source;
  if (d.destination !== undefined) update.destination = d.destination;
  if (d.priority    !== undefined) update.priority    = d.priority;
  if (d.status      !== undefined) update.status      = d.status;
  if (d.clientId    !== undefined) update.clientId    = d.clientId;
  if (d.projectId   !== undefined) update.projectId   = d.projectId;
  if (d.userId      !== undefined) update.userId      = d.userId;
  if (d.notes       !== undefined) update.notes       = d.notes;
  await db.update(orchestrationEventsTable).set(update).where(eq(orchestrationEventsTable.id, params.data.id));
  const [updated] = await db.select().from(orchestrationEventsTable).where(eq(orchestrationEventsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/orchestration-events/:id", async (req, res): Promise<void> => {
  const params = DeleteOrchestrationEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(orchestrationEventsTable).where(eq(orchestrationEventsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
