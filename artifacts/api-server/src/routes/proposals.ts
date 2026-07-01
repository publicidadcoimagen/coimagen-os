import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, proposalsTable } from "@workspace/db";
import {
  CreateProposalBody,
  GetProposalParams,
  UpdateProposalParams,
  UpdateProposalBody,
  DeleteProposalParams,
  ListProposalsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const fmt = (p: typeof proposalsTable.$inferSelect) => ({
  ...p,
  amount: p.amount !== null ? parseFloat(p.amount) : null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
});

router.get("/proposals", async (req, res): Promise<void> => {
  const qp = ListProposalsQueryParams.safeParse(req.query);
  let rows = await db.select().from(proposalsTable).orderBy(proposalsTable.createdAt);
  if (qp.success && qp.data.status) rows = rows.filter((r) => r.status === qp.data.status);
  if (qp.success && qp.data.prospectId) rows = rows.filter((r) => r.prospectId === qp.data.prospectId);
  if (qp.success && qp.data.clientId) rows = rows.filter((r) => r.clientId === qp.data.clientId);
  res.json(rows.map(fmt));
});

router.post("/proposals", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateProposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(proposalsTable).values({
    title: parsed.data.title,
    prospectId: parsed.data.prospectId ?? null,
    clientId: parsed.data.clientId ?? null,
    amount: parsed.data.amount?.toString() ?? null,
    status: parsed.data.status ?? "draft",
    notes: parsed.data.notes ?? null,
    validUntil: parsed.data.validUntil ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/proposals/:id", async (req, res): Promise<void> => {
  const params = GetProposalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(fmt(row));
});

router.patch("/proposals/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateProposalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [row] = await db.update(proposalsTable).set(updateData).where(eq(proposalsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(fmt(row));
});

router.delete("/proposals/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteProposalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(proposalsTable).where(eq(proposalsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.sendStatus(204);
});

export default router;
