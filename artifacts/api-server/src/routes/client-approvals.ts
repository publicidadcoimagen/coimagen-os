import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, clientApprovalsTable } from "@workspace/db";
import {
  ListClientApprovalsQueryParams,
  CreateClientApprovalBody,
  GetClientApprovalParams,
  UpdateClientApprovalParams,
  UpdateClientApprovalBody,
  DeleteClientApprovalParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { isClienteRole, ownOrgIds, ownsOrgId } from "../middlewares/clientScope";

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
  if (isClienteRole(req)) {
    const ids = (await ownOrgIds(req)) ?? [];
    if (ids.length === 0) { res.json([]); return; }
    conditions.push(inArray(clientApprovalsTable.orgId, ids));
  } else if (q.data.orgId) {
    conditions.push(eq(clientApprovalsTable.orgId, q.data.orgId));
  }
  if (q.data.status) conditions.push(eq(clientApprovalsTable.status, q.data.status));
  if (q.data.type) conditions.push(eq(clientApprovalsTable.type, q.data.type));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(desc(clientApprovalsTable.createdAt));
  res.json(rows.map(serialize));
});

// A cliente-role caller may request an approval for their own org only.
// Staff can request one for any org.
router.post("/client-approvals", async (req, res): Promise<void> => {
  const body = CreateClientApprovalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  if (isClienteRole(req)) {
    if (!(await ownsOrgId(req, d.orgId))) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  } else {
    const staffRole = (req.user as { role?: string })?.role ?? "viewer";
    if (!["ceo", "admin"].includes(staffRole)) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  }
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
  if (!row || (isClienteRole(req) && !(await ownsOrgId(req, row.orgId)))) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

// A cliente-role caller may PATCH only an approval for their own org, and
// only the reviewer-facing fields (status/comments/reviewedBy) — never
// title/type/description/fileUrl, which stay staff-authored. Staff keep
// full edit access to any field on any approval, as before.
router.patch("/client-approvals/:id", async (req, res): Promise<void> => {
  const params = UpdateClientApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateClientApprovalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  if (isClienteRole(req)) {
    const [existing] = await db.select().from(clientApprovalsTable).where(eq(clientApprovalsTable.id, params.data.id));
    if (!existing || !(await ownsOrgId(req, existing.orgId))) { res.status(404).json({ error: "Not found" }); return; }
    const reviewerFieldsOnly = Object.keys(d).every((k) => ["status", "comments", "reviewedBy"].includes(k));
    if (!reviewerFieldsOnly) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  } else {
    const staffRole = (req.user as { role?: string })?.role ?? "viewer";
    if (!["ceo", "admin"].includes(staffRole)) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  }

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

router.delete("/client-approvals/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteClientApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(clientApprovalsTable).where(eq(clientApprovalsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
