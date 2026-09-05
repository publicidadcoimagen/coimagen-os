import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  contentCalendarItemsTable,
  contentCalendarTargetsTable,
  type ContentCalendarItem,
  type ContentCalendarTarget,
} from "@workspace/db";
import {
  CreateContentCalendarItemBody,
  UpdateContentCalendarItemBody,
  GenerateContentCalendarItemBody,
} from "@workspace/api-zod";
import { isClienteRole, ownsClientId, ownsModule } from "../middlewares/clientScope";
import { getPublisherForClient } from "../lib/social-autopublisher/publisher";
import { generateCaptionAndCreateDraft } from "../lib/social-autopublisher/caption";

// Mounted at /clients/:clientId/content-calendar — mergeParams so :clientId
// from the parent mount is visible on req.params here.
const router: IRouter = Router({ mergeParams: true });

// "autopublicador" module gate (P-79 module matrix), same pattern as
// catalog.ts's "ecommerce" gate: a cliente-role caller whose client doesn't
// have this module enabled, or who isn't the owner of :clientId, gets a
// clean 403. Staff are always unrestricted (see clientScope).
router.use(async (req, res, next): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(403).json({ error: "Not available for this account" }); return; }
  if (!(await ownsModule(req, "autopublicador"))) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
});

function serializeTarget(t: ContentCalendarTarget) {
  return {
    ...t,
    publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
  };
}

function serializeItem(item: ContentCalendarItem, targets: ContentCalendarTarget[]) {
  return {
    ...item,
    scheduledAt: item.scheduledAt ? item.scheduledAt.toISOString() : null,
    approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
    targets: targets.map(serializeTarget),
  };
}

async function loadItemWithTargets(clientId: number, id: number) {
  const [item] = await db.select().from(contentCalendarItemsTable).where(
    and(eq(contentCalendarItemsTable.id, id), eq(contentCalendarItemsTable.clientId, clientId)),
  );
  if (!item) return null;
  const targets = await db.select().from(contentCalendarTargetsTable)
    .where(eq(contentCalendarTargetsTable.calendarItemId, item.id));
  return { item, targets };
}

router.get("/items", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conditions = [eq(contentCalendarItemsTable.clientId, clientId)];
  if (status) conditions.push(eq(contentCalendarItemsTable.status, status));
  const items = await db.select().from(contentCalendarItemsTable).where(and(...conditions));
  if (items.length === 0) { res.json([]); return; }
  const targets = await db.select().from(contentCalendarTargetsTable)
    .where(inArray(contentCalendarTargetsTable.calendarItemId, items.map((i) => i.id)));
  res.json(items.map((item) =>
    serializeItem(item, targets.filter((t) => t.calendarItemId === item.id)),
  ));
});

router.post("/items", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const body = CreateContentCalendarItemBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [item] = await db.insert(contentCalendarItemsTable).values({
    clientId,
    caption: d.caption,
    mediaUrls: d.mediaUrls ?? null,
    scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
    createdBy: d.createdBy ?? req.user?.email ?? null,
    status: "draft",
  }).returning();
  const targets = await db.insert(contentCalendarTargetsTable).values(
    d.targets.map((network) => ({ calendarItemId: item!.id, network, status: "pending" })),
  ).returning();
  res.status(201).json(serializeItem(item!, targets));
});

// Generates a caption with DeepSeek and creates its draft in one step — the
// only path that actually populates the generation* usage/cost columns
// (plain POST /items above stays for manually-written captions, unpriced).
router.post("/items/generate", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const body = GenerateContentCalendarItemBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  try {
    const { item, targets } = await generateCaptionAndCreateDraft({
      clientId,
      topic: d.topic,
      networks: d.networks,
      tone: d.tone,
      createdBy: req.user?.email ?? undefined,
    });
    res.status(201).json(serializeItem(item, targets));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/items/:id", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeItem(found.item, found.targets));
});

router.patch("/items/:id", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const body = UpdateContentCalendarItemBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  if (found.item.status !== "draft" && found.item.status !== "pending_approval") {
    res.status(409).json({ error: `No se puede editar un item en estado "${found.item.status}"` });
    return;
  }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.caption !== undefined) update.caption = d.caption;
  if (d.mediaUrls !== undefined) update.mediaUrls = d.mediaUrls;
  if (d.scheduledAt !== undefined) update.scheduledAt = new Date(d.scheduledAt);
  await db.update(contentCalendarItemsTable).set(update).where(eq(contentCalendarItemsTable.id, id));
  const updated = await loadItemWithTargets(clientId, id);
  res.json(serializeItem(updated!.item, updated!.targets));
});

router.post("/items/:id/submit", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  if (found.item.status !== "draft") {
    res.status(409).json({ error: `Solo se puede enviar a aprobación un item en estado "draft" (actual: "${found.item.status}")` });
    return;
  }
  await db.update(contentCalendarItemsTable).set({
    status: "pending_approval",
    updatedAt: new Date(),
  }).where(eq(contentCalendarItemsTable.id, id));
  const updated = await loadItemWithTargets(clientId, id);
  res.json(serializeItem(updated!.item, updated!.targets));
});

// Shared by both /publish (staff, manual) and /approve's client-portal
// branch below (see there for why). Throws on a bad-state transition so
// each caller can shape its own error response; returns null only for a
// row that's disappeared between the caller's own lookup and this one.
async function publishItem(clientId: number, id: number) {
  const found = await loadItemWithTargets(clientId, id);
  if (!found) return null;
  if (found.item.status !== "approved") {
    throw new Error(`Solo se puede publicar un item en estado "approved" (actual: "${found.item.status}")`);
  }

  for (const target of found.targets) {
    try {
      const publisher = await getPublisherForClient(clientId, target.network);
      const result = await publisher.publish({
        network: target.network,
        caption: found.item.caption,
        mediaUrls: (found.item.mediaUrls as string[] | null) ?? undefined,
      });
      await db.update(contentCalendarTargetsTable).set({
        status: "published",
        publisherMode: publisher.mode,
        externalPostId: result.externalPostId,
        publishedAt: result.publishedAt,
        failureReason: null,
        updatedAt: new Date(),
      }).where(eq(contentCalendarTargetsTable.id, target.id));
    } catch (err) {
      await db.update(contentCalendarTargetsTable).set({
        status: "failed",
        failureReason: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      }).where(eq(contentCalendarTargetsTable.id, target.id));
    }
  }

  const refreshed = await loadItemWithTargets(clientId, id);
  const allPublished = refreshed!.targets.every((t) => t.status === "published");
  await db.update(contentCalendarItemsTable).set({
    status: allPublished ? "published" : "failed",
    updatedAt: new Date(),
  }).where(eq(contentCalendarItemsTable.id, id));

  return loadItemWithTargets(clientId, id);
}

router.post("/items/:id/approve", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const isCliente = isClienteRole(req);
  if (!isCliente) {
    const staffRole = (req.user as { role?: string })?.role ?? "viewer";
    if (!["ceo", "admin"].includes(staffRole)) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  }
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  if (found.item.status !== "pending_approval") {
    res.status(409).json({ error: `Solo se puede aprobar un item en estado "pending_approval" (actual: "${found.item.status}") — primero hay que enviarlo a aprobación con /submit` });
    return;
  }
  await db.update(contentCalendarItemsTable).set({
    status: "approved",
    approvedBy: req.user?.email ?? null,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(contentCalendarItemsTable.id, id));

  // A client's own approval inside the Client Room portal is the only human
  // gate this agent has — nothing else in the system ever calls /publish (no
  // scheduler exists, and the internal Autopublicador Social view never
  // wires usePublishContentCalendarItem either), so completing a client's
  // portal approval is what actually fires the real publish (Camila,
  // 2026-09-05: "ningún contenido se autopublica sin aprobación explícita en
  // el portal"). A staff approval from the internal view keeps the existing
  // two-step behavior (approve now, a separate manual /publish call later).
  if (isCliente) {
    const final = await publishItem(clientId, id);
    res.json(serializeItem(final!.item, final!.targets));
    return;
  }
  const updated = await loadItemWithTargets(clientId, id);
  res.json(serializeItem(updated!.item, updated!.targets));
});

router.post("/items/:id/publish", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  try {
    const final = await publishItem(clientId, id);
    if (!final) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeItem(final.item, final.targets));
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
