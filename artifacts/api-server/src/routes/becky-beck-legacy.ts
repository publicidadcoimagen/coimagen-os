import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreateBeckyBeckLegacyProductBody,
  UpdateBeckyBeckLegacyProductParams,
  UpdateBeckyBeckLegacyProductBody,
  DeleteBeckyBeckLegacyProductParams,
} from "@workspace/api-zod";
import { db, organizationsTable } from "@workspace/db";
import { ownsModule, ownsClientId } from "../middlewares/clientScope";
import { listLegacyProducts, getLegacyProductImage } from "../lib/becky-beck-legacy";
import {
  createLegacyProduct,
  updateLegacyProduct,
  deleteLegacyProduct,
  type BeckyBeckLegacyProductRecord,
} from "../lib/becky-beck-legacy-write";

const router: IRouter = Router();

// The Client Room dashboard (portal.coimagenmedia.com) and this API
// (api.coimagenmedia.com) are different origins, and <img src> — unlike the
// generated API hooks' fetch calls — never goes through custom-fetch's
// setBaseUrl() rewriting, so a path relative to "/" resolves against the
// dashboard's own origin instead and gets swallowed by Vercel's SPA
// catch-all rewrite (serves index.html, not the image). Same fix already
// used by public-catalog.ts for the same reason.
const API_PUBLIC_BASE_URL = process.env.API_PUBLIC_BASE_URL ?? "https://coimagen-os-api.onrender.com";

function toImageUrl(id: string, hasImage: boolean): string | null {
  return hasImage ? `${API_PUBLIC_BASE_URL}/api/becky-beck-legacy/products/${encodeURIComponent(id)}/image` : null;
}

function toApiProduct(product: BeckyBeckLegacyProductRecord) {
  return {
    id: product.id,
    nameEs: product.nameEs,
    nameEn: product.nameEn,
    category: product.category,
    priceUsd: product.priceUsd,
    available: product.available,
    imageUrl: toImageUrl(product.id, product.imageKey != null),
  };
}

// Becky's own clientId, resolved from her org slug rather than hardcoded,
// so it stays correct if her row is ever recreated. Cached for the process
// lifetime — the slug→clientId mapping doesn't change at runtime.
let beckyClientIdCache: number | null | undefined;
async function getBeckyBeckClientId(): Promise<number | null> {
  if (beckyClientIdCache !== undefined) return beckyClientIdCache;
  const rows = await db.select({ clientId: organizationsTable.clientId }).from(organizationsTable).where(eq(organizationsTable.slug, "beckybeck"));
  beckyClientIdCache = rows[0]?.clientId ?? null;
  return beckyClientIdCache;
}

// "ecommerce" module gate, same as catalog.ts — PLUS a check that the
// caller is specifically Becky's own client, not just any client with
// "ecommerce" enabled. Unlike the sibling generic /products routes (scoped
// by clientId on every query), these handlers are hardcoded to Becky's
// single Netlify Blobs store with no clientId parameter at all — without
// this second check, any other "ecommerce" client would read (and, now
// that writes exist, overwrite/delete) Becky's real catalog. Read-only
// access to this same data was already effectively public (becky-beck-site
// itself has no auth), but writes are a real cross-tenant risk once a
// second Ecommerce-tier client exists.
router.use(async (req, res, next): Promise<void> => {
  if (!(await ownsModule(req, "ecommerce"))) { res.status(403).json({ error: "Not available for this account" }); return; }
  const beckyClientId = await getBeckyBeckClientId();
  if (!ownsClientId(req, beckyClientId)) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
});

router.get("/becky-beck-legacy/products", async (_req, res): Promise<void> => {
  const products = await listLegacyProducts();
  res.json(products.map((p) => ({
    ...p,
    imageUrl: p.imageUrl ? `${API_PUBLIC_BASE_URL}/api/becky-beck-legacy/products/${encodeURIComponent(p.id)}/image` : null,
  })));
});

router.get("/becky-beck-legacy/products/:id/image", async (req, res): Promise<void> => {
  const image = await getLegacyProductImage(req.params.id);
  if (!image) { res.sendStatus(404); return; }
  res.set("Content-Type", image.mime).send(image.buffer);
});

router.post("/becky-beck-legacy/products", async (req, res): Promise<void> => {
  const parsed = CreateBeckyBeckLegacyProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const product = await createLegacyProduct(parsed.data);
    res.status(201).json(toApiProduct(product));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo crear el producto" });
  }
});

router.patch("/becky-beck-legacy/products/:id", async (req, res): Promise<void> => {
  const params = UpdateBeckyBeckLegacyProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateBeckyBeckLegacyProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const product = await updateLegacyProduct(params.data.id, parsed.data);
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(toApiProduct(product));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo actualizar el producto" });
  }
});

router.delete("/becky-beck-legacy/products/:id", async (req, res): Promise<void> => {
  const params = DeleteBeckyBeckLegacyProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const deleted = await deleteLegacyProduct(params.data.id);
  if (!deleted) { res.status(404).json({ error: "Product not found" }); return; }
  res.sendStatus(204);
});

export default router;
