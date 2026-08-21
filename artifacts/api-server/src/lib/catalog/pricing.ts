import type { Product } from "@workspace/db";

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface PricedOrderItem {
  productId: string;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  quantity: number;
  subtotalCents: number;
}

export interface PricedOrder {
  items: PricedOrderItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
}

export class CartValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "empty_cart" | "product_not_found" | "product_unavailable" | "insufficient_stock" | "mixed_currency",
  ) {
    super(message);
  }
}

// Pure pricing/validation for a public checkout cart — no DB, no PayPal, no
// I/O, so it's fully unit-testable (same "pure eligibility functions"
// pattern as lib/payment-schedule/generate.ts). Prices/names are always
// snapshotted from the real `products` row passed in here, never trusted
// from the client — the caller is responsible for loading `products` by id
// from the DB immediately before calling this, so stock/price can't be
// stale by more than one request.
export function priceCart(lines: CartLine[], products: Map<string, Product>): PricedOrder {
  if (lines.length === 0) throw new CartValidationError("El carrito está vacío", "empty_cart");

  let currency: string | null = null;
  const items: PricedOrderItem[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) throw new CartValidationError(`Producto no encontrado: ${line.productId}`, "product_not_found");
    if (!product.available) throw new CartValidationError(`"${product.nameEs}" ya no está disponible`, "product_unavailable");
    if (product.stock != null && product.stock < line.quantity) {
      throw new CartValidationError(`No hay suficiente inventario de "${product.nameEs}" (disponible: ${product.stock})`, "insufficient_stock");
    }
    if (currency === null) currency = product.currency;
    else if (currency !== product.currency) {
      throw new CartValidationError("Todos los productos del carrito deben tener la misma moneda", "mixed_currency");
    }
    items.push({
      productId: product.id,
      nameSnapshot: product.nameEs,
      priceCentsSnapshot: product.priceCents,
      quantity: line.quantity,
      subtotalCents: product.priceCents * line.quantity,
    });
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.subtotalCents, 0);
  const shippingCents = 0; // no shipping-rate integration in v1 — see pendientes-5-6 design doc
  return { items, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, currency: currency! };
}
