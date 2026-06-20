import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, prospectsTable } from "@workspace/db";
import {
  CreateProspectBody,
  GetProspectParams,
  UpdateProspectParams,
  UpdateProspectBody,
  DeleteProspectParams,
  ListProspectsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const fmt = (p: typeof prospectsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
});

router.get("/prospects", async (req, res): Promise<void> => {
  const qp = ListProspectsQueryParams.safeParse(req.query);
  let rows = await db.select().from(prospectsTable).orderBy(prospectsTable.createdAt);
  if (qp.success && qp.data.status) rows = rows.filter((r) => r.status === qp.data.status);
  res.json(rows.map(fmt));
});

router.post("/prospects", async (req, res): Promise<void> => {
  const parsed = CreateProspectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(prospectsTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    company: parsed.data.company ?? null,
    industry: parsed.data.industry ?? null,
    status: parsed.data.status ?? "lead",
    source: parsed.data.source ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/prospects/:id", async (req, res): Promise<void> => {
  const params = GetProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.json(fmt(row));
});

router.patch("/prospects/:id", async (req, res): Promise<void> => {
  const params = UpdateProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProspectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(prospectsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(prospectsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.json(fmt(row));
});

router.delete("/prospects/:id", async (req, res): Promise<void> => {
  const params = DeleteProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(prospectsTable).where(eq(prospectsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.sendStatus(204);
});

export default router;
