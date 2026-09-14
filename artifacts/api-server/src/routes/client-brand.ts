import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientBrandTable } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";
import { ownsClientId } from "../middlewares/clientScope";
import { saveClientLogo, getClientLogo } from "../lib/client-brand-blobs";

const router: IRouter = Router();

const serializeBrand = (r: typeof clientBrandTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
});

// Patchable by a client via PATCH below — everything except logoUrl, which
// only the dedicated logo endpoint may set (it needs to decode/validate the
// image first), and the staff-only fields (fonts, brandManualUrl,
// brandNotes) that stay out of the client-facing wizard's scope.
const CLIENT_PATCHABLE_FIELDS = [
  "brandColors", "businessDescription", "whatsappNumber", "websiteUrl",
  "facebookUrl", "instagramUrl", "tiktokUrl", "linkedinUrl", "googleBusinessUrl", "youtubeUrl",
] as const;

router.get("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(404).json({ error: "Not found" }); return; }
  const [row] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeBrand(row));
});

router.put("/clients/:clientId/brand", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const body = req.body;
  const [existing] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));
  const values = {
    clientId,
    logoUrl: body.logoUrl ?? null,
    brandColors: body.brandColors ?? null,
    fonts: body.fonts ?? null,
    brandManualUrl: body.brandManualUrl ?? null,
    brandNotes: body.brandNotes ?? null,
    businessDescription: body.businessDescription ?? null,
    whatsappNumber: body.whatsappNumber ?? null,
    websiteUrl: body.websiteUrl ?? null,
    facebookUrl: body.facebookUrl ?? null,
    instagramUrl: body.instagramUrl ?? null,
    tiktokUrl: body.tiktokUrl ?? null,
    linkedinUrl: body.linkedinUrl ?? null,
    googleBusinessUrl: body.googleBusinessUrl ?? null,
    youtubeUrl: body.youtubeUrl ?? null,
    updatedAt: new Date(),
  };
  let row;
  if (existing) {
    [row] = await db.update(clientBrandTable).set(values).where(eq(clientBrandTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientBrandTable).values(values).returning();
  }
  res.json(serializeBrand(row));
});

// Client self-service partial update (Fase C content-capture), scoped to the
// caller's own clientId — separate from the staff PUT above (full-overwrite,
// staff-only, untouched). Only merges the specific keys present in the
// body, so a client submitting just their website URL doesn't blank out
// everything else staff or the client already entered.
router.patch("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(403).json({ error: "Not available for this account" }); return; }
  const body = req.body ?? {};
  const [existing] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of CLIENT_PATCHABLE_FIELDS) {
    if (key in body) patch[key] = body[key] ? String(body[key]).slice(0, 2000) : null;
  }

  let row;
  if (existing) {
    [row] = await db.update(clientBrandTable).set(patch).where(eq(clientBrandTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientBrandTable).values({ clientId, ...patch }).returning();
  }
  res.json(serializeBrand(row));
});

// Raw logo bytes — served as an <img src> target, not through the JSON API
// client, same shape as GET /products/:id/images/:index.
router.get("/clients/:clientId/brand/logo", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.sendStatus(404); return; }
  const image = await getClientLogo(clientId);
  if (!image) { res.sendStatus(404); return; }
  res.set("Content-Type", image.mime).send(image.buffer);
});

// Client self-service logo upload, scoped to the caller's own clientId.
// Decodes/validates the data URI (mime allowlist enforced in
// client-brand-blobs.ts, same as product images) before storing it, then
// points logoUrl at this same route so it's always the latest upload.
router.patch("/clients/:clientId/brand/logo", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(403).json({ error: "Not available for this account" }); return; }
  const imageBase64 = (req.body ?? {}).imageBase64;
  if (typeof imageBase64 !== "string") { res.status(400).json({ error: "imageBase64 is required" }); return; }

  try {
    await saveClientLogo(clientId, imageBase64);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid image" });
    return;
  }

  const logoUrl = `/api/clients/${clientId}/brand/logo`;
  const [existing] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));
  let row;
  if (existing) {
    [row] = await db.update(clientBrandTable).set({ logoUrl, updatedAt: new Date() }).where(eq(clientBrandTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientBrandTable).values({ clientId, logoUrl }).returning();
  }
  res.json(serializeBrand(row));
});

export default router;
