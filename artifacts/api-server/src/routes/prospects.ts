import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, prospectsTable } from "@workspace/db";
import {
  CreateProspectBody,
  GetProspectParams,
  UpdateProspectParams,
  UpdateProspectBody,
  DeleteProspectParams,
  ListProspectsQueryParams,
  ConvertProspectBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { convertProspectToClient } from "../lib/prospect-conversion/repository";

const router: IRouter = Router();

const fmt = (p: typeof prospectsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
});

router.get("/prospects", async (req, res): Promise<void> => {
  const qp = ListProspectsQueryParams.safeParse(req.query);
  let query = db.select().from(prospectsTable).$dynamic();
  if (qp.success && qp.data.status) query = query.where(eq(prospectsTable.status, qp.data.status));
  const rows = await query.orderBy(prospectsTable.createdAt);
  res.json(rows.map(fmt));
});

router.post("/prospects", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateProspectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(prospectsTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    company: parsed.data.company ?? null,
    industry: parsed.data.industry ?? null,
    status: parsed.data.status ?? "lead",
    source: parsed.data.source ?? null,
    notes: parsed.data.notes ?? null,
    clientId: parsed.data.clientId ?? null,
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

router.patch("/prospects/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProspectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(prospectsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(prospectsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.json(fmt(row));
});

// Formally converts a prospect into a client — replaces the old cosmetic
// "Convertir" pipeline button (which only flipped prospects.status, creating
// nothing in `clients`). See docs/prospect-to-client-conversion.md for the
// full design and why each precondition/safeguard exists.
router.post("/prospects/:id/convert", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = GetProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ConvertProspectBody.safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const user = req.user as { id: string; name?: string | null; email?: string | null };
  const actorLabel = user.name || user.email || user.id;

  const result = await convertProspectToClient(params.data.id, { id: user.id, label: actorLabel }, { confirmTestSource: body.data.confirmTestSource ?? false });

  if (!result.ok) {
    if (result.error === "prospect_not_found") { res.status(404).json({ error: result.error }); return; }
    if (result.error === "already_converted") {
      res.status(409).json({ error: result.error, client: { ...result.client, createdAt: result.client.createdAt.toISOString(), updatedAt: result.client.updatedAt ? result.client.updatedAt.toISOString() : null } });
      return;
    }
    res.status(409).json({ error: result.error });
    return;
  }

  res.status(201).json({
    ...result.client,
    createdAt: result.client.createdAt.toISOString(),
    updatedAt: result.client.updatedAt ? result.client.updatedAt.toISOString() : null,
  });
});

router.delete("/prospects/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteProspectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(prospectsTable).where(eq(prospectsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Prospect not found" }); return; }
  res.sendStatus(204);
});

export default router;
