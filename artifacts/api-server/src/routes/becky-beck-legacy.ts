import { Router, type IRouter } from "express";
import { ownsModule } from "../middlewares/clientScope";
import { listLegacyProducts, getLegacyProductImage } from "../lib/becky-beck-legacy";

const router: IRouter = Router();

// Same "ecommerce" module gate as catalog.ts — read-only, and the source
// data is already public with no auth on becky-beck-site itself, so this
// isn't a security boundary, just consistency with the sibling routes.
router.use(async (req, res, next): Promise<void> => {
  if (!(await ownsModule(req, "ecommerce"))) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
});

router.get("/becky-beck-legacy/products", async (_req, res): Promise<void> => {
  const products = await listLegacyProducts();
  res.json(products.map((p) => ({
    ...p,
    imageUrl: p.imageUrl ? `/becky-beck-legacy/products/${encodeURIComponent(p.id)}/image` : null,
  })));
});

router.get("/becky-beck-legacy/products/:id/image", async (req, res): Promise<void> => {
  const image = await getLegacyProductImage(req.params.id);
  if (!image) { res.sendStatus(404); return; }
  res.set("Content-Type", image.mime).send(image.buffer);
});

export default router;
