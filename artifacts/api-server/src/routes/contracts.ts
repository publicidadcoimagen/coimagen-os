import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";
import {
  ListContractsQueryParams,
  CreateContractBody,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
  DeleteContractParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(r: typeof contractsTable.$inferSelect) {
  return {
    ...r,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/contracts", async (req, res): Promise<void> => {
  const q = ListContractsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  let query = db.select().from(contractsTable).$dynamic();
  const conditions = [];
  if (q.data.status) conditions.push(eq(contractsTable.status, q.data.status));
  if (q.data.type) conditions.push(eq(contractsTable.type, q.data.type));
  if (q.data.clientId) conditions.push(eq(contractsTable.clientId, q.data.clientId));
  if (q.data.projectId) conditions.push(eq(contractsTable.projectId, q.data.projectId));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await query.orderBy(desc(contractsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/contracts", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateContractBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const [row] = await db.insert(contractsTable).values({
    type: d.type,
    title: d.title,
    description: d.description ?? null,
    service: d.service ?? null,
    clientId: d.clientId ?? null,
    projectId: d.projectId ?? null,
    workflowId: d.workflowId ?? null,
    invoiceId: d.invoiceId ?? null,
    approvalId: d.approvalId ?? null,
    content: d.content ?? null,
    amount: d.amount ?? null,
    currency: d.currency ?? "MXN",
    terms: d.terms ?? null,
    notes: d.notes ?? null,
    sentAt: d.sentAt ? new Date(d.sentAt) : null,
    signedAt: d.signedAt ? new Date(d.signedAt) : null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    createdBy: d.createdBy ?? null,
    signedBy: d.signedBy ?? null,
    status: "draft",
  }).returning();

  res.status(201).json(serialize(row));
});

router.get("/contracts/:id", async (req, res): Promise<void> => {
  const params = GetContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/contracts/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateContractBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.type !== undefined) update.type = d.type;
  if (d.status !== undefined) update.status = d.status;
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.service !== undefined) update.service = d.service;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.projectId !== undefined) update.projectId = d.projectId;
  if (d.workflowId !== undefined) update.workflowId = d.workflowId;
  if (d.invoiceId !== undefined) update.invoiceId = d.invoiceId;
  if (d.approvalId !== undefined) update.approvalId = d.approvalId;
  if (d.content !== undefined) update.content = d.content;
  if (d.amount !== undefined) update.amount = d.amount;
  if (d.currency !== undefined) update.currency = d.currency;
  if (d.terms !== undefined) update.terms = d.terms;
  if (d.notes !== undefined) update.notes = d.notes;
  if (d.sentAt !== undefined) update.sentAt = d.sentAt ? new Date(d.sentAt) : null;
  if (d.signedAt !== undefined) update.signedAt = d.signedAt ? new Date(d.signedAt) : null;
  if (d.expiresAt !== undefined) update.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  if (d.createdBy !== undefined) update.createdBy = d.createdBy;
  if (d.signedBy !== undefined) update.signedBy = d.signedBy;

  await db.update(contractsTable).set(update).where(eq(contractsTable.id, params.data.id));
  const [updated] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/contracts/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(contractsTable).where(eq(contractsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
