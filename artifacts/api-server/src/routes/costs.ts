import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, costsTable, invoicesTable } from "@workspace/db";
import {
  CreateCostBody,
  GetCostParams,
  UpdateCostParams,
  UpdateCostBody,
  DeleteCostParams,
  ListCostsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const fmt = (c: typeof costsTable.$inferSelect) => ({
  ...c,
  amount: parseFloat(c.amount),
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
});

router.get("/costs", async (req, res): Promise<void> => {
  const qp = ListCostsQueryParams.safeParse(req.query);
  let query = db.select().from(costsTable).$dynamic();
  const conditions = [];
  if (qp.success && qp.data.month) conditions.push(eq(costsTable.month, qp.data.month));
  if (qp.success && qp.data.category) conditions.push(eq(costsTable.category, qp.data.category));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(costsTable.month);
  res.json(rows.map(fmt));
});

router.post("/costs", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(costsTable).values({
    category: parsed.data.category,
    month: parsed.data.month,
    amount: parsed.data.amount.toString(),
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/costs/summary/:month", async (req, res): Promise<void> => {
  const month = Array.isArray(req.params.month) ? req.params.month[0] : req.params.month;
  const rows = await db.select().from(costsTable).where(eq(costsTable.month, month));
  const totalCosts = rows.reduce((s, r) => s + parseFloat(r.amount), 0);
  const allInvoices = await db.select().from(invoicesTable);
  const monthInvoices = allInvoices.filter((i) => i.issuedDate?.startsWith(month) && i.status === "paid");
  const totalRevenue = monthInvoices.reduce((s, i) => s + parseFloat(i.amount), 0);
  const estimatedMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
  const breakdown = rows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.amount),
    percentage: totalCosts > 0 ? Math.round((parseFloat(r.amount) / totalCosts) * 1000) / 10 : 0,
  }));
  res.json({ month, totalCosts: Math.round(totalCosts * 100) / 100, totalRevenue: Math.round(totalRevenue * 100) / 100, estimatedMargin: Math.round(estimatedMargin * 10) / 10, breakdown });
});

router.get("/costs/:id", async (req, res): Promise<void> => {
  const params = GetCostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(costsTable).where(eq(costsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.json(fmt(row));
});

router.patch("/costs/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateCostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [row] = await db.update(costsTable).set(updateData).where(eq(costsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.json(fmt(row));
});

router.delete("/costs/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteCostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(costsTable).where(eq(costsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.sendStatus(204);
});

export default router;
