import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, ticketsTable } from "@workspace/db";
import {
  ListQcTicketsQueryParams,
  GetQcTicketParams,
  UpdateQcTicketParams,
  UpdateQcTicketBody,
  DeleteQcTicketParams,
  CreateQcTicketBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(r: typeof ticketsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.post("/quality-tickets", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateQcTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(ticketsTable).values({
    title: d.title,
    description: d.description ?? null,
    incidentId: d.incidentId ?? null,
    status: d.status ?? "open",
    priority: d.priority ?? "medium",
    assignedToType: d.assignedToType ?? null,
    assignedToId: d.assignedToId ?? null,
    assignedToName: d.assignedToName ?? null,
    projectId: d.projectId ?? null,
    clientId: d.clientId ?? null,
    dueDate: d.dueDate ?? null,
    notes: d.notes ?? null,
  }).returning();
  res.status(201).json(serialize(row!));
});

router.get("/quality-tickets", async (req, res): Promise<void> => {
  const q = ListQcTicketsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  let query = db.select().from(ticketsTable).$dynamic();
  const conditions = [];
  if (q.data.status) conditions.push(eq(ticketsTable.status, q.data.status));
  if (q.data.incidentId) conditions.push(eq(ticketsTable.incidentId, q.data.incidentId));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(desc(ticketsTable.createdAt));
  res.json(rows.map(serialize));
});

router.get("/quality-tickets/:id", async (req, res): Promise<void> => {
  const params = GetQcTicketParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/quality-tickets/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateQcTicketParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateQcTicketBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.status !== undefined) update.status = d.status;
  if (d.priority !== undefined) update.priority = d.priority;
  if (d.assignedToType !== undefined) update.assignedToType = d.assignedToType;
  if (d.assignedToId !== undefined) update.assignedToId = d.assignedToId;
  if (d.assignedToName !== undefined) update.assignedToName = d.assignedToName;
  if (d.projectId !== undefined) update.projectId = d.projectId;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.dueDate !== undefined) update.dueDate = d.dueDate;
  if (d.resolvedAt !== undefined) update.resolvedAt = d.resolvedAt;
  if (d.notes !== undefined) update.notes = d.notes;
  await db.update(ticketsTable).set(update).where(eq(ticketsTable.id, params.data.id));
  const [updated] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/quality-tickets/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteQcTicketParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(ticketsTable).where(eq(ticketsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
