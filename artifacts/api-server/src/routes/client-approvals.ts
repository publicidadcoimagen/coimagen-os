import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, clientApprovalsTable } from "@workspace/db";
import {
  ListClientApprovalsQueryParams,
  CreateClientApprovalBody,
  GetClientApprovalParams,
  UpdateClientApprovalParams,
  UpdateClientApprovalBody,
  DeleteClientApprovalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(r: typeof clientApprovalsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/client-approvals", async (req, res): Promise<void> => {
  const q = ListClientApprovalsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  let query = db.select().from(clientApprovalsTable).$dynamic();
  const conditions = [];
  if (q.data.orgId) conditions.push(eq(clientApprovalsTable.orgId, q.data.orgId));
  if (q.data.status) conditions.push(eq(clientApprovalsTable.status, q.data.status));
  if (q.data.type) conditions.push(eq(clientApprovalsTable.type, q.data.type));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(desc(clientApprovalsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/client-approvals", async (req, res): Promise<void> => {
  const body = CreateClientApprovalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [row] = await db.insert(clientApprovalsTable).values({
    orgId: d.orgId,
    type: d.type,
    title: d.title,
    description: d.description ?? null,
    fileUrl: d.fileUrl ?? null,
    requestedBy: d.requestedBy ?? null,
    status: "pending",
  }).returning();
  res.status(201).json(serialize(row));
});

router.get("/client-approvals/:id", async (req, res): Promise<void> => {
  const params = GetClientApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(clientApprovalsTable).where(eq(clientApprovalsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/client-approvals/:id", async (req, res): Promise<void> => {
  const params = UpdateClientApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateClientApprovalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.type !== undefined) update.type = d.type;
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.status !== undefined) update.status = d.status;
  if (d.fileUrl !== undefined) update.fileUrl = d.fileUrl;
  if (d.comments !== undefined) update.comments = d.comments;
  if (d.reviewedBy !== undefined) update.reviewedBy = d.reviewedBy;
  await db.update(clientApprovalsTable).set(update).where(eq(clientApprovalsTable.id, params.data.id));
  const [updated] = await db.select().from(clientApprovalsTable).where(eq(clientApprovalsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/client-approvals/:id", async (req, res): Promise<void> => {
  const params = DeleteClientApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(clientApprovalsTable).where(eq(clientApprovalsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
