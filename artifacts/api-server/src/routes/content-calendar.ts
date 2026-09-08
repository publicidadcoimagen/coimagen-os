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
import { requireRole } from "../middlewares/requireAuth";
import { getPublisherForClient } from "../lib/social-autopublisher/publisher";
import { generateCaptionAndCreateDraft, isClaimBlockedError, assertNoProhibitedClaim } from "../lib/social-autopublisher/caption";
import { reportAgentFailure } from "../lib/agent-escalation/report";

const AGENT_NAME = "Autopublicador Social";

// Mounted at /clients/:clientId/content-calendar — mergeParams so :clientId
// from the parent mount is visible on req.params here.
const router: IRouter = Router({ mergeParams: true });

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
  try {
    assertNoProhibitedClaim(d.caption);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
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
    const message = err instanceof Error ? err.message : String(err);
    const claimBlocked = isClaimBlockedError(message);
    await reportAgentFailure({
      agentName: AGENT_NAME,
      category: claimBlocked ? "claim_blocked" : "generation_error",
      severity: "low",
      title: claimBlocked ? `Caption bloqueado — cliente ${clientId}` : `Fallo de generación DeepSeek — cliente ${clientId}`,
      description: message,
      notify: !claimBlocked, // Motor de Escalación §Decisiones #3
    });
    res.status(502).json({ error: message });
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

router.post("/items/:id/approve", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  if (found.item.status !== "pending_approval") {
    res.status(409).json({ error: `Solo se puede aprobar un item en estado "pending_approval" (actual: "${found.item.status}") — primero hay que enviarlo a aprobación con /submit` });
    return;
  }
  // Final gate: this is the last point before a caption becomes immutable
  // (PATCH only allows edits while draft/pending_approval) and eligible for
  // /publish, so it must catch a prohibited claim regardless of whether the
  // caption came from /generate (already checked there), manual creation
  // (already checked in POST /items), or a manual edit made after either of
  // those checks ran (PATCH has no check of its own).
  try {
    assertNoProhibitedClaim(found.item.caption);
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  await db.update(contentCalendarItemsTable).set({
    status: "approved",
    approvedBy: req.user?.email ?? null,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(contentCalendarItemsTable.id, id));
  const updated = await loadItemWithTargets(clientId, id);
  res.json(serializeItem(updated!.item, updated!.targets));
});

router.post("/items/:id/publish", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const id = parseInt(req.params.id as string);
  const found = await loadItemWithTargets(clientId, id);
  if (!found) { res.status(404).json({ error: "Not found" }); return; }
  if (found.item.status !== "approved") {
    res.status(409).json({ error: `Solo se puede publicar un item en estado "approved" (actual: "${found.item.status}")` });
    return;
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
      const message = err instanceof Error ? err.message : String(err);
      await db.update(contentCalendarTargetsTable).set({
        status: "failed",
        failureReason: message,
        updatedAt: new Date(),
      }).where(eq(contentCalendarTargetsTable.id, target.id));
      await reportAgentFailure({
        agentName: AGENT_NAME,
        category: "publish_failed",
        severity: "high",
        title: `Fallo al publicar en "${target.network}" — item #${id}`,
        description: message,
      });
    }
  }

  const refreshed = await loadItemWithTargets(clientId, id);
  const allPublished = refreshed!.targets.every((t) => t.status === "published");
  await db.update(contentCalendarItemsTable).set({
    status: allPublished ? "published" : "failed",
    updatedAt: new Date(),
  }).where(eq(contentCalendarItemsTable.id, id));

  const final = await loadItemWithTargets(clientId, id);
  res.json(serializeItem(final!.item, final!.targets));
});

export default router;
