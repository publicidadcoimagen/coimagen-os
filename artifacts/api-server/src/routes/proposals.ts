import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
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
  let query = db.select().from(proposalsTable).$dynamic();
  const conditions = [];
  if (qp.success && qp.data.status) conditions.push(eq(proposalsTable.status, qp.data.status));
  if (qp.success && qp.data.prospectId) conditions.push(eq(proposalsTable.prospectId, qp.data.prospectId));
  if (qp.success && qp.data.clientId) conditions.push(eq(proposalsTable.clientId, qp.data.clientId));
  // Excludes real is_test rows (e.g. the $45,000 "Propuesta de Prueba" and
  // NULL-AMOUNT-PROBE) from the Pipeline's "Valor cerrado" KPI by default —
  // pass includeTest=true to see them.
  if (!(qp.success && qp.data.includeTest)) conditions.push(eq(proposalsTable.isTest, false));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(proposalsTable.createdAt);
  res.json(rows.map(fmt));
});

// "accepted" only ever gets set by the client approving from their public
// proposal link (POST /public/proposals/:token/approve), which also
// generates the payment-schedule invoices (createInstallmentInvoices). A
// proposal created or PATCHed straight to "accepted" from here would skip
// that invoice generation silently — this happened for real (proposal
// #7, "ECOMERCE", 2026-09-15) before this guard existed.
const ACCEPTED_STATUS_ERROR = {
  error: "El estado 'accepted' no se puede asignar manualmente — solo lo activa el cliente al aprobar desde su enlace público, lo que además genera las facturas del plan de pagos.",
};

router.post("/proposals", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateProposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "accepted") { res.status(400).json(ACCEPTED_STATUS_ERROR); return; }
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
  if (parsed.data.status === "accepted") { res.status(400).json(ACCEPTED_STATUS_ERROR); return; }
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
