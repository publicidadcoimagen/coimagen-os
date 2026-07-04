import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable, clientsTable } from "@workspace/db";
import {
  CreateSubscriptionBody,
  GetSubscriptionParams,
  UpdateSubscriptionParams,
  UpdateSubscriptionBody,
  DeleteSubscriptionParams,
  ListSubscriptionsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/subscriptions", async (req, res): Promise<void> => {
  const qp = ListSubscriptionsQueryParams.safeParse(req.query);
  let query = db.select({
    id: subscriptionsTable.id, clientId: subscriptionsTable.clientId, clientName: clientsTable.name,
    plan: subscriptionsTable.plan, amount: subscriptionsTable.amount, billingCycle: subscriptionsTable.billingCycle,
    status: subscriptionsTable.status, startDate: subscriptionsTable.startDate, nextBillingDate: subscriptionsTable.nextBillingDate,
    notes: subscriptionsTable.notes, createdAt: subscriptionsTable.createdAt, updatedAt: subscriptionsTable.updatedAt,
  }).from(subscriptionsTable).leftJoin(clientsTable, eq(subscriptionsTable.clientId, clientsTable.id)).$dynamic();
  const conditions = [];
  if (qp.success && qp.data.clientId) conditions.push(eq(subscriptionsTable.clientId, qp.data.clientId));
  if (qp.success && qp.data.status) conditions.push(eq(subscriptionsTable.status, qp.data.status));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(subscriptionsTable.createdAt);
  res.json(rows.map((r) => ({ ...r, amount: parseFloat(r.amount), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null })));
});

router.post("/subscriptions", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(subscriptionsTable).values({
    clientId: parsed.data.clientId ?? null,
    plan: parsed.data.plan,
    amount: parsed.data.amount.toString(),
    billingCycle: parsed.data.billingCycle ?? "monthly",
    status: parsed.data.status ?? "active",
    startDate: parsed.data.startDate ?? null,
    nextBillingDate: parsed.data.nextBillingDate ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.status(201).json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.get("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = GetSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select({
    id: subscriptionsTable.id, clientId: subscriptionsTable.clientId, clientName: clientsTable.name,
    plan: subscriptionsTable.plan, amount: subscriptionsTable.amount, billingCycle: subscriptionsTable.billingCycle,
    status: subscriptionsTable.status, startDate: subscriptionsTable.startDate, nextBillingDate: subscriptionsTable.nextBillingDate,
    notes: subscriptionsTable.notes, createdAt: subscriptionsTable.createdAt, updatedAt: subscriptionsTable.updatedAt,
  }).from(subscriptionsTable).leftJoin(clientsTable, eq(subscriptionsTable.clientId, clientsTable.id)).where(eq(subscriptionsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json({ ...row, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.patch("/subscriptions/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [row] = await db.update(subscriptionsTable).set(updateData).where(eq(subscriptionsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Subscription not found" }); return; }
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.delete("/subscriptions/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.sendStatus(204);
});

export default router;
