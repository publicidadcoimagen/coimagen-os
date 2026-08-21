import { Router, type IRouter } from "express";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  ListOrdersQueryParams,
  GetOrderParams,
  FulfillOrderParams,
} from "@workspace/api-zod";
import { db, productsTable, type Product, type Order, type OrderItem } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ownsModule, isClienteRole, ownClientId } from "../middlewares/clientScope";
import { listProducts, getProductById, listOrders, getOrderById, fulfillOrder } from "../lib/catalog/repository";
import { saveProductImage, getProductImage, deleteProductImage, productImageKey } from "../lib/product-images-blobs";

const router: IRouter = Router();

// Same module gate as the Becky Beck catalog it generalizes — cliente-role
// callers whose client doesn't have "ecommerce" enabled get a clean 403;
// staff are always unrestricted (see ownsModule).
router.use(async (req, res, next): Promise<void> => {
  if (!(await ownsModule(req, "ecommerce"))) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
});

function toApiProduct(product: Product) {
  return {
    id: product.id,
    clientId: product.clientId,
    nameEs: product.nameEs,
    nameEn: product.nameEn,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    currency: product.currency,
    stock: product.stock,
    sku: product.sku,
    available: product.available,
    imageUrls: product.imageKeys.map((_, i) => `/api/products/${product.id}/images/${i}`),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
  };
}

function toApiOrder(order: Order & { items: OrderItem[] }) {
  return {
    id: order.id,
    clientId: order.clientId,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    shippingAddress: order.shippingAddress,
    status: order.status as "pending" | "paid" | "fulfilled" | "cancelled",
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    paypalOrderId: order.paypalOrderId,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    fulfilledAt: order.fulfilledAt ? order.fulfilledAt.toISOString() : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      nameSnapshot: item.nameSnapshot,
      priceCentsSnapshot: item.priceCentsSnapshot,
      quantity: item.quantity,
      subtotalCents: item.subtotalCents,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const qp = ListProductsQueryParams.safeParse(req.query);
  const clientId = isClienteRole(req) ? ownClientId(req) : (qp.success ? (qp.data.clientId ?? null) : null);
  const products = await listProducts(clientId);
  res.json(products.map(toApiProduct));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const clientId = isClienteRole(req) ? ownClientId(req)! : parsed.data.clientId;
  if (clientId == null) { res.status(400).json({ error: "clientId es obligatorio" }); return; }

  const [row] = await db.insert(productsTable).values({
    clientId,
    nameEs: parsed.data.nameEs,
    nameEn: parsed.data.nameEn,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    priceCents: parsed.data.priceCents,
    currency: parsed.data.currency ?? "USD",
    stock: parsed.data.stock ?? null,
    sku: parsed.data.sku ?? null,
    available: parsed.data.available ?? true,
    imageKeys: [],
  }).returning();

  let imageKeys: string[] = [];
  if (parsed.data.imagesBase64?.length) {
    imageKeys = await Promise.all(
      parsed.data.imagesBase64.map(async (dataUri, i) => {
        const key = productImageKey(clientId, row.id, i);
        await saveProductImage(key, dataUri);
        return key;
      }),
    );
    await db.update(productsTable).set({ imageKeys }).where(eq(productsTable.id, row.id));
  }

  res.status(201).json(toApiProduct({ ...row, imageKeys }));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const parsed = GetProductParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const product = await getProductById(parsed.data.id);
  if (!product || (isClienteRole(req) && product.clientId !== ownClientId(req))) { res.status(404).json({ error: "Producto no encontrado" }); return; }
  res.json(toApiProduct(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await getProductById(params.data.id);
  if (!existing || (isClienteRole(req) && existing.clientId !== ownClientId(req))) { res.status(404).json({ error: "Producto no encontrado" }); return; }

  let imageKeys = existing.imageKeys;
  if (parsed.data.imagesBase64) {
    // Replaces the whole image set — delete the old blobs first so nothing
    // orphaned lingers in the store.
    await Promise.all(existing.imageKeys.map((key) => deleteProductImage(key)));
    imageKeys = await Promise.all(
      parsed.data.imagesBase64.map(async (dataUri, i) => {
        const key = productImageKey(existing.clientId, existing.id, i);
        await saveProductImage(key, dataUri);
        return key;
      }),
    );
  }

  const [updated] = await db.update(productsTable).set({
    nameEs: parsed.data.nameEs ?? existing.nameEs,
    nameEn: parsed.data.nameEn ?? existing.nameEn,
    description: parsed.data.description !== undefined ? parsed.data.description : existing.description,
    category: parsed.data.category ?? existing.category,
    priceCents: parsed.data.priceCents ?? existing.priceCents,
    currency: parsed.data.currency ?? existing.currency,
    stock: parsed.data.stock !== undefined ? parsed.data.stock : existing.stock,
    sku: parsed.data.sku !== undefined ? parsed.data.sku : existing.sku,
    available: parsed.data.available ?? existing.available,
    imageKeys,
    updatedAt: new Date(),
  }).where(eq(productsTable.id, existing.id)).returning();

  res.json(toApiProduct(updated));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const parsed = DeleteProductParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await getProductById(parsed.data.id);
  if (!existing || (isClienteRole(req) && existing.clientId !== ownClientId(req))) { res.status(404).json({ error: "Producto no encontrado" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, existing.id));
  await Promise.all(existing.imageKeys.map((key) => deleteProductImage(key)));
  res.sendStatus(204);
});

router.get("/orders", async (req, res): Promise<void> => {
  const qp = ListOrdersQueryParams.safeParse(req.query);
  const clientId = isClienteRole(req) ? ownClientId(req) : (qp.success ? (qp.data.clientId ?? null) : null);
  const orders = await listOrders(clientId);
  res.json(orders.map(toApiOrder));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const order = await getOrderById(parsed.data.id);
  if (!order || (isClienteRole(req) && order.clientId !== ownClientId(req))) { res.status(404).json({ error: "Orden no encontrada" }); return; }
  res.json(toApiOrder(order));
});

// Staff-only in practice (fulfillment is an agency-support action, same as
// uploading a fiscal document) — not blocked at the route level beyond the
// module/ownership gate above since a client marking their own paid order
// "shipped" isn't a real risk, just not a flow the UI exposes to them yet.
router.post("/orders/:id/fulfill", async (req, res): Promise<void> => {
  const parsed = FulfillOrderParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await getOrderById(parsed.data.id);
  if (!existing || (isClienteRole(req) && existing.clientId !== ownClientId(req))) { res.status(404).json({ error: "Orden no encontrada" }); return; }
  if (existing.status !== "paid") { res.status(409).json({ error: "Solo se pueden marcar como enviadas las órdenes ya pagadas" }); return; }

  const updated = await fulfillOrder(existing.id);
  const withItems = updated ? { ...updated, items: existing.items } : existing;
  res.json(toApiOrder(withItems));
});

// Serves a product image's raw bytes — authenticated (staff/client-room),
// separate from the public route below which serves the same bytes without
// auth for storefront use.
router.get("/products/:id/images/:index", async (req, res): Promise<void> => {
  const product = await getProductById(req.params.id);
  if (!product || (isClienteRole(req) && product.clientId !== ownClientId(req))) { res.sendStatus(404); return; }
  const index = Number(req.params.index);
  const key = product.imageKeys[index];
  if (!key) { res.sendStatus(404); return; }
  const image = await getProductImage(key);
  if (!image) { res.sendStatus(404); return; }
  res.set("Content-Type", image.mime).send(image.buffer);
});

export default router;
