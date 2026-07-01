import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, incidentsTable, ticketsTable } from "@workspace/db";
import {
  ListIncidentsQueryParams,
  CreateIncidentBody,
  GetIncidentParams,
  UpdateIncidentParams,
  UpdateIncidentBody,
  DeleteIncidentParams,
  ConvertIncidentToTicketParams,
  ConvertIncidentToTicketBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(r: typeof incidentsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/incidents", async (req, res): Promise<void> => {
  const q = ListIncidentsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  let query = db.select().from(incidentsTable).$dynamic();
  const conditions = [];
  if (q.data.status) conditions.push(eq(incidentsTable.status, q.data.status));
  if (q.data.type) conditions.push(eq(incidentsTable.type, q.data.type));
  if (q.data.severity) conditions.push(eq(incidentsTable.severity, q.data.severity));
  if (q.data.priority) conditions.push(eq(incidentsTable.priority, q.data.priority));
  if (q.data.clientId) conditions.push(eq(incidentsTable.clientId, q.data.clientId));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await query.orderBy(desc(incidentsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/incidents", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateIncidentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const [row] = await db.insert(incidentsTable).values({
    type: d.type ?? "bug",
    title: d.title,
    description: d.description ?? null,
    severity: d.severity ?? "medium",
    priority: d.priority ?? "medium",
    module: d.module ?? null,
    clientId: d.clientId ?? null,
    projectId: d.projectId ?? null,
    workflowId: d.workflowId ?? null,
    mundoId: d.mundoId ?? null,
    agentId: d.agentId ?? null,
    evidences: d.evidences ?? null,
    logs: d.logs ?? null,
    date: d.date ?? null,
    timeSpent: d.timeSpent ?? null,
    responsibleId: d.responsibleId ?? null,
    solution: d.solution ?? null,
    lessonLearned: d.lessonLearned ?? null,
    status: "open",
  }).returning();

  res.status(201).json(serialize(row));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/incidents/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateIncidentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.type !== undefined) update.type = d.type;
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.severity !== undefined) update.severity = d.severity;
  if (d.priority !== undefined) update.priority = d.priority;
  if (d.status !== undefined) update.status = d.status;
  if (d.module !== undefined) update.module = d.module;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.projectId !== undefined) update.projectId = d.projectId;
  if (d.workflowId !== undefined) update.workflowId = d.workflowId;
  if (d.mundoId !== undefined) update.mundoId = d.mundoId;
  if (d.agentId !== undefined) update.agentId = d.agentId;
  if (d.evidences !== undefined) update.evidences = d.evidences;
  if (d.logs !== undefined) update.logs = d.logs;
  if (d.date !== undefined) update.date = d.date;
  if (d.timeSpent !== undefined) update.timeSpent = d.timeSpent;
  if (d.responsibleId !== undefined) update.responsibleId = d.responsibleId;
  if (d.solution !== undefined) update.solution = d.solution;
  if (d.lessonLearned !== undefined) update.lessonLearned = d.lessonLearned;
  if (d.ticketId !== undefined) update.ticketId = d.ticketId;

  await db.update(incidentsTable).set(update).where(eq(incidentsTable.id, params.data.id));
  const [updated] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/incidents/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/incidents/:id/convert-ticket", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = ConvertIncidentToTicketParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = ConvertIncidentToTicketBody.safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!incident) { res.status(404).json({ error: "Not found" }); return; }

  const d = body.data;
  const [ticket] = await db.insert(ticketsTable).values({
    incidentId: params.data.id,
    title: incident.title,
    description: incident.description ?? null,
    status: "open",
    priority: incident.priority,
    assignedToType: d.assignedToType ?? null,
    assignedToId: d.assignedToId ?? null,
    assignedToName: d.assignedToName ?? null,
    projectId: incident.projectId ?? null,
    clientId: incident.clientId ?? null,
    dueDate: d.dueDate ?? null,
    notes: d.notes ?? null,
  }).returning();

  await db.update(incidentsTable).set({
    ticketId: ticket.id,
    status: "in_progress",
    updatedAt: new Date(),
  }).where(eq(incidentsTable.id, params.data.id));

  res.status(201).json({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt ? ticket.updatedAt.toISOString() : null,
  });
});

export default router;
