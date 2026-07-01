import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable, clientsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/invoices", async (req, res): Promise<void> => {
  const qp = ListInvoicesQueryParams.safeParse(req.query);
  const rows = await db.select({
    id: invoicesTable.id,
    number: invoicesTable.number,
    clientId: invoicesTable.clientId,
    clientName: clientsTable.name,
    amount: invoicesTable.amount,
    status: invoicesTable.status,
    issuedDate: invoicesTable.issuedDate,
    dueDate: invoicesTable.dueDate,
    description: invoicesTable.description,
    createdAt: invoicesTable.createdAt,
    updatedAt: invoicesTable.updatedAt,
  }).from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id)).orderBy(invoicesTable.createdAt);
  let filtered = rows;
  if (qp.success && qp.data.clientId) filtered = filtered.filter((r) => r.clientId === qp.data.clientId);
  if (qp.success && qp.data.status) filtered = filtered.filter((r) => r.status === qp.data.status);
  res.json(filtered.map((r) => ({ ...r, amount: parseFloat(r.amount), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null })));
});

router.post("/invoices", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(invoicesTable).values({
    number: parsed.data.number,
    clientId: parsed.data.clientId ?? null,
    amount: parsed.data.amount.toString(),
    status: parsed.data.status ?? "draft",
    issuedDate: parsed.data.issuedDate ?? null,
    dueDate: parsed.data.dueDate ?? null,
    description: parsed.data.description ?? null,
  }).returning();
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.status(201).json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select({
    id: invoicesTable.id, number: invoicesTable.number, clientId: invoicesTable.clientId,
    clientName: clientsTable.name, amount: invoicesTable.amount, status: invoicesTable.status,
    issuedDate: invoicesTable.issuedDate, dueDate: invoicesTable.dueDate, description: invoicesTable.description,
    createdAt: invoicesTable.createdAt, updatedAt: invoicesTable.updatedAt,
  }).from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id)).where(eq(invoicesTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json({ ...row, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.patch("/invoices/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [row] = await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  let clientName: string | null = null;
  if (row.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, row.clientId));
    clientName = c?.name ?? null;
  }
  res.json({ ...row, clientName, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null });
});

router.delete("/invoices/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.sendStatus(204);
});

export default router;
