import { pgTable, serial, text, timestamp, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { productsTable } from "./products";

// E-commerce checkout — deliberately its own table, never invoices/
// invoice_payments. Cuotas/invoices are Coimagen billing its own clients
// for agency services; an order here is a client's own end-customer buying
// that client's products — a different payer relationship entirely. See
// pendientes-5-6 design doc for the full reasoning.
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  // The client who owns the catalog being sold from — not the buyer.
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone"),
  // Null for digital/pickup-only orders — no shipping-rate/carrier
  // integration in v1, just a free-text/structured address on file.
  shippingAddress: jsonb("shipping_address").$type<Record<string, string> | null>(),
  status: text("status").notNull().default("pending"), // pending | paid | fulfilled | cancelled
  currency: text("currency").notNull().default("USD"),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  // PayPal Orders API identifiers for this order's single payment attempt —
  // no installments/recovery sequence here, unlike invoices.
  paypalOrderId: text("paypal_order_id").unique(),
  paypalCaptureId: text("paypal_capture_id"),
  paidAt: timestamp("paid_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  // Nullable + set null on delete: a product can be removed from the
  // catalog later without breaking historical order records, since the
  // name/price are snapshotted below anyway.
  productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  nameSnapshot: text("name_snapshot").notNull(),
  priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
  quantity: integer("quantity").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;
