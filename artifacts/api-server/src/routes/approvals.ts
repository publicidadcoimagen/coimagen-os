import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, approvalsTable } from "@workspace/db";
import {
  CreateApprovalBody,
  GetApprovalParams,
  UpdateApprovalParams,
  UpdateApprovalBody,
  DeleteApprovalParams,
  ListApprovalsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const fmt = (a: typeof approvalsTable.$inferSelect) => ({
  ...a,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt ? a.updatedAt.toISOString() : null,
});

router.get("/approvals", async (req, res): Promise<void> => {
  const qp = ListApprovalsQueryParams.safeParse(req.query);
  let rows = await db.select().from(approvalsTable).orderBy(approvalsTable.createdAt);
  if (qp.success && qp.data.status) rows = rows.filter((r) => r.status === qp.data.status);
  if (qp.success && qp.data.type) rows = rows.filter((r) => r.type === qp.data.type);
  res.json(rows.map(fmt));
});

router.post("/approvals", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(approvalsTable).values({
    title: parsed.data.title,
    type: parsed.data.type,
    status: parsed.data.status ?? "draft",
    submittedBy: parsed.data.submittedBy ?? null,
    reviewedBy: parsed.data.reviewedBy ?? null,
    entityId: parsed.data.entityId ?? null,
    entityType: parsed.data.entityType ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/approvals/:id", async (req, res): Promise<void> => {
  const params = GetApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Approval not found" }); return; }
  res.json(fmt(row));
});

router.patch("/approvals/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(approvalsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(approvalsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Approval not found" }); return; }
  res.json(fmt(row));
});

router.delete("/approvals/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteApprovalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(approvalsTable).where(eq(approvalsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Approval not found" }); return; }
  res.sendStatus(204);
});

export default router;
