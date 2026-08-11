import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateBeckyBeckProductBody,
  UpdateBeckyBeckProductParams,
  UpdateBeckyBeckProductBody,
  DeleteBeckyBeckProductParams,
} from "@workspace/api-zod";
import {
  listBeckyBeckProducts,
  saveBeckyBeckProducts,
  saveBeckyBeckProductImage,
  deleteBeckyBeckProductImage,
  type BeckyBeckProductRecord,
} from "../lib/becky-beck-blobs";
import { ownsModule } from "../middlewares/clientScope";

const router: IRouter = Router();

const BECKY_BECK_SITE_URL = process.env.BECKY_BECK_SITE_URL ?? "https://beckybech.netlify.app";

// The catalog is a single Netlify Blobs store, not scoped per client — fine
// while Becky is the only "ecommerce" client, but this gate is what stops a
// future second ecommerce client's cliente-role login from reading or
// editing Becky's catalog (P-79).
router.use(async (req, res, next): Promise<void> => {
  if (!(await ownsModule(req, "ecommerce"))) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
});

function toApiShape(product: BeckyBeckProductRecord) {
  return {
    id: product.id,
    nameEs: product.nameEs,
    nameEn: product.nameEn,
    category: product.category,
    priceUsd: product.priceUsd,
    available: product.available,
    imageUrl: product.imageKey
      ? `${BECKY_BECK_SITE_URL}/.netlify/functions/product-image?id=${encodeURIComponent(product.id)}`
      : null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

router.get("/becky-beck/products", async (_req, res): Promise<void> => {
  const products = await listBeckyBeckProducts();
  res.json(products.map(toApiShape));
});

router.post("/becky-beck/products", async (req, res): Promise<void> => {
  const parsed = CreateBeckyBeckProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const record: BeckyBeckProductRecord = {
    id,
    nameEs: parsed.data.nameEs,
    nameEn: parsed.data.nameEn,
    category: parsed.data.category,
    priceUsd: parsed.data.priceUsd,
    available: parsed.data.available ?? true,
    imageKey: null,
    createdAt: now,
    updatedAt: null,
  };

  if (parsed.data.imageBase64) {
    const imageKey = `images/${id}`;
    await saveBeckyBeckProductImage(imageKey, parsed.data.imageBase64);
    record.imageKey = imageKey;
  }

  const products = await listBeckyBeckProducts();
  products.push(record);
  await saveBeckyBeckProducts(products);

  res.status(201).json(toApiShape(record));
});

router.patch("/becky-beck/products/:id", async (req, res): Promise<void> => {
  const params = UpdateBeckyBeckProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBeckyBeckProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const products = await listBeckyBeckProducts();
  const index = products.findIndex((p) => p.id === params.data.id);
  if (index === -1) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const existing = products[index];
  const updated: BeckyBeckProductRecord = {
    ...existing,
    nameEs: parsed.data.nameEs ?? existing.nameEs,
    nameEn: parsed.data.nameEn ?? existing.nameEn,
    category: parsed.data.category ?? existing.category,
    priceUsd: parsed.data.priceUsd ?? existing.priceUsd,
    available: parsed.data.available ?? existing.available,
    updatedAt: new Date().toISOString(),
  };

  if (parsed.data.imageBase64) {
    const imageKey = existing.imageKey ?? `images/${existing.id}`;
    await saveBeckyBeckProductImage(imageKey, parsed.data.imageBase64);
    updated.imageKey = imageKey;
  }

  products[index] = updated;
  await saveBeckyBeckProducts(products);

  res.json(toApiShape(updated));
});

router.delete("/becky-beck/products/:id", async (req, res): Promise<void> => {
  const params = DeleteBeckyBeckProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const products = await listBeckyBeckProducts();
  const index = products.findIndex((p) => p.id === params.data.id);
  if (index === -1) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [removed] = products.splice(index, 1);
  await saveBeckyBeckProducts(products);
  if (removed.imageKey) {
    await deleteBeckyBeckProductImage(removed.imageKey);
  }

  res.sendStatus(204);
});

export default router;
