import { eq, and, sql, inArray } from "drizzle-orm";
import { db, productsTable, ordersTable, orderItemsTable, type Product, type Order, type OrderItem } from "@workspace/db";
import type { PricedOrder } from "./pricing";

export async function listProducts(clientId: number | null): Promise<Product[]> {
  const query = db.select().from(productsTable).$dynamic();
  const rows = clientId != null ? await query.where(eq(productsTable.clientId, clientId)) : await query;
  return rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  return row ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Map<string, Product>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(productsTable).where(inArray(productsTable.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export async function listOrders(clientId: number | null): Promise<OrderWithItems[]> {
  const query = db.select().from(ordersTable).$dynamic();
  const orders = clientId != null ? await query.where(eq(ordersTable.clientId, clientId)) : await query;
  if (orders.length === 0) return [];
  const items = await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orders.map((o) => o.id)));
  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  return orders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }));
}

export async function getOrderById(id: number): Promise<OrderWithItems | null> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  return { ...order, items };
}

export interface CreateOrderInput {
  clientId: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  shippingAddress: Record<string, string> | null;
  priced: PricedOrder;
}

// Creates the order + its line items atomically — never a partial order
// with no items, or items with no parent order.
export async function createOrderWithItems(input: CreateOrderInput): Promise<OrderWithItems> {
  return db.transaction(async (tx) => {
    const [order] = await tx.insert(ordersTable).values({
      clientId: input.clientId,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      buyerPhone: input.buyerPhone,
      shippingAddress: input.shippingAddress,
      status: "pending",
      currency: input.priced.currency,
      subtotalCents: input.priced.subtotalCents,
      shippingCents: input.priced.shippingCents,
      totalCents: input.priced.totalCents,
    }).returning();

    const items = await tx.insert(orderItemsTable).values(
      input.priced.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        nameSnapshot: item.nameSnapshot,
        priceCentsSnapshot: item.priceCentsSnapshot,
        quantity: item.quantity,
        subtotalCents: item.subtotalCents,
      })),
    ).returning();

    return { ...order, items };
  });
}

export async function setOrderPaypalOrderId(orderId: number, paypalOrderId: string): Promise<void> {
  await db.update(ordersTable).set({ paypalOrderId, updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
}

export interface OversoldItem {
  productId: string;
  nameSnapshot: string;
  quantityOrdered: number;
}

export interface MarkOrderPaidResult {
  status: "paid" | "already_paid";
  // Non-empty only when the conditional stock decrement below didn't apply
  // for one or more items — a real oversell race, not a bug in this
  // function. The order still ends up "paid" (the PayPal charge already
  // happened and can't be undone here), so the caller is responsible for
  // alerting staff — see sendOversoldAlertEmail in ./email.ts.
  oversoldItems: OversoldItem[];
}

// Durable source of truth for "this order was actually paid" — called only
// from the PAYMENT.CAPTURE.COMPLETED webhook handler, never from the
// synchronous capture route (same principle as invoices/payment-schedule).
// Idempotent: a duplicate webhook delivery for an already-paid order is a
// no-op and does NOT decrement stock a second time. Stock is re-checked
// (not just re-decremented blindly) here — the soft check at order-creation
// time doesn't protect against two buyers racing for the last unit between
// order creation and payment.
export async function markOrderPaidAndDecrementStock(orderId: number, paypalCaptureId: string | null): Promise<MarkOrderPaidResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    if (order.status !== "pending") return { status: "already_paid", oversoldItems: [] };

    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    const oversoldItems: OversoldItem[] = [];
    for (const item of items) {
      if (!item.productId) continue;
      // Conditional decrement — only applies if enough stock remains,
      // guarding the race between order creation and payment (a second
      // buyer's order could have been created and paid first). `returning`
      // is how we detect whether the WHERE actually matched — an empty
      // result means the stock condition failed, i.e. a real oversell.
      const updated = await tx.update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, item.productId), sql`${productsTable.stock} IS NULL OR ${productsTable.stock} >= ${item.quantity}`))
        .returning({ id: productsTable.id });
      if (updated.length === 0) {
        oversoldItems.push({ productId: item.productId, nameSnapshot: item.nameSnapshot, quantityOrdered: item.quantity });
      }
    }

    await tx.update(ordersTable).set({ status: "paid", paypalCaptureId, paidAt: new Date(), updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
    return { status: "paid", oversoldItems };
  });
}

export async function fulfillOrder(orderId: number): Promise<Order | null> {
  const [updated] = await db.update(ordersTable)
    .set({ status: "fulfilled", fulfilledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "paid")))
    .returning();
  return updated ?? null;
}
