import { Router, type IRouter } from "express";
import {
  ListPublicCatalogProductsParams,
  CreatePublicCatalogOrderParams,
  CreatePublicCatalogOrderBody,
  CapturePublicCatalogOrderParams,
  CapturePublicCatalogOrderBody,
} from "@workspace/api-zod";
import { listProducts, getProductById, getProductsByIds, createOrderWithItems, setOrderPaypalOrderId, getOrderById } from "../lib/catalog/repository";
import { priceCart, CartValidationError } from "../lib/catalog/pricing";
import { createCatalogOrder, captureOrder } from "../lib/paypal/orders";
import { getProductImage } from "../lib/product-images-blobs";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PRODUCT_IMAGE_BASE_URL = process.env.API_PUBLIC_BASE_URL ?? "https://coimagen-os-api.onrender.com";

// Public, unauthenticated — powers a client's storefront (e.g. Becky
// Beck's site), same "own site per ecommerce client" pattern as today,
// but backed by the generalized multi-tenant catalog instead of a
// hardcoded single-tenant Blobs store.
router.get("/public/catalog/:clientId/products", async (req, res): Promise<void> => {
  const parsed = ListPublicCatalogProductsParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const products = await listProducts(parsed.data.clientId);
  res.json(
    products
      .filter((p) => p.available)
      .map((p) => ({
        id: p.id,
        clientId: p.clientId,
        nameEs: p.nameEs,
        nameEn: p.nameEn,
        description: p.description,
        category: p.category,
        priceCents: p.priceCents,
        currency: p.currency,
        stock: p.stock,
        sku: p.sku,
        available: p.available,
        imageUrls: p.imageKeys.map((_, i) => `${PRODUCT_IMAGE_BASE_URL}/api/public/catalog/${p.clientId}/products/${p.id}/images/${i}`),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
      })),
  );
});

router.get("/public/catalog/:clientId/products/:id/images/:index", async (req, res): Promise<void> => {
  const product = await getProductById(req.params.id);
  if (!product || product.clientId !== Number(req.params.clientId) || !product.available) { res.sendStatus(404); return; }
  const key = product.imageKeys[Number(req.params.index)];
  if (!key) { res.sendStatus(404); return; }
  const image = await getProductImage(key);
  if (!image) { res.sendStatus(404); return; }
  res.set("Content-Type", image.mime).send(image.buffer);
});

// Creates the order + its PayPal order together, as a guest checkout — no
// account required, matching the public storefront's existing read-only
// pattern. Amount is computed entirely server-side from real product rows
// (see priceCart), never trusted from the request body.
router.post("/public/catalog/:clientId/orders", async (req, res): Promise<void> => {
  const params = CreatePublicCatalogOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreatePublicCatalogOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const productIds = [...new Set(parsed.data.items.map((i) => i.productId))];
  const products = await getProductsByIds(productIds);
  // Only products actually belonging to this client's catalog are eligible
  // — prevents a crafted request from checking out another client's item
  // under this client's order.
  for (const product of products.values()) {
    if (product.clientId !== params.data.clientId) products.delete(product.id);
  }

  let priced;
  try {
    priced = priceCart(parsed.data.items, products);
  } catch (err) {
    if (err instanceof CartValidationError) { res.status(400).json({ error: err.message, code: err.code }); return; }
    throw err;
  }

  const order = await createOrderWithItems({
    clientId: params.data.clientId,
    buyerName: parsed.data.buyerName,
    buyerEmail: parsed.data.buyerEmail,
    buyerPhone: parsed.data.buyerPhone ?? null,
    shippingAddress: parsed.data.shippingAddress ?? null,
    priced,
  });

  try {
    const paypalOrderId = await createCatalogOrder({ orderId: order.id, totalCents: order.totalCents, currency: order.currency });
    await setOrderPaypalOrderId(order.id, paypalOrderId);
    res.status(201).json({ orderId: order.id, paypalOrderId, totalCents: order.totalCents, currency: order.currency });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "No se pudo crear la orden de PayPal para el checkout de catálogo");
    res.status(502).json({ error: "No se pudo iniciar el pago con PayPal. Intenta de nuevo." });
  }
});

// Synchronous capture — optimistic UI feedback ONLY, same pattern as
// public-invoices.ts. PAYMENT.CAPTURE.COMPLETED (webhooks-paypal.ts) is the
// only place that marks the order paid and decrements stock.
router.post("/public/catalog/:clientId/orders/:orderId/capture", async (req, res): Promise<void> => {
  const params = CapturePublicCatalogOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CapturePublicCatalogOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const order = await getOrderById(params.data.orderId);
  if (!order || order.clientId !== params.data.clientId) { res.status(404).json({ error: "Orden no encontrada" }); return; }

  try {
    const result = await captureOrder(parsed.data.paypalOrderId);
    res.json({ status: result.status });
  } catch (err) {
    logger.error({ err, orderId: order.id, paypalOrderId: parsed.data.paypalOrderId }, "No se pudo capturar la orden de PayPal del catálogo");
    res.status(502).json({ error: "No se pudo confirmar el pago con PayPal. Si el cargo se realizó, se reflejará en unos momentos." });
  }
});

export default router;
