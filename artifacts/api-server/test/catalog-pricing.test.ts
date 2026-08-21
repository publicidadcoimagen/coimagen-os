import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { priceCart, CartValidationError, type CartLine } from "../src/lib/catalog/pricing";
import type { Product } from "@workspace/db";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    clientId: 1,
    nameEs: "Bolso de cuero",
    nameEn: "Leather bag",
    description: null,
    category: "bolso",
    priceCents: 5000,
    currency: "USD",
    stock: 10,
    sku: null,
    available: true,
    imageKeys: [],
    variants: null,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

describe("priceCart", () => {
  test("empty cart throws empty_cart", () => {
    assert.throws(() => priceCart([], new Map()), (err: unknown) => err instanceof CartValidationError && err.code === "empty_cart");
  });

  test("single line — subtotal, shipping (0), total all agree", () => {
    const product = fakeProduct();
    const lines: CartLine[] = [{ productId: "prod-1", quantity: 2 }];
    const priced = priceCart(lines, new Map([["prod-1", product]]));
    assert.equal(priced.subtotalCents, 10000);
    assert.equal(priced.shippingCents, 0);
    assert.equal(priced.totalCents, 10000);
    assert.equal(priced.currency, "USD");
    assert.deepEqual(priced.items, [{
      productId: "prod-1", nameSnapshot: "Bolso de cuero", priceCentsSnapshot: 5000, quantity: 2, subtotalCents: 10000,
    }]);
  });

  test("multiple lines sum correctly", () => {
    const products = new Map([
      ["prod-1", fakeProduct({ id: "prod-1", priceCents: 5000 })],
      ["prod-2", fakeProduct({ id: "prod-2", nameEs: "Llavero", priceCents: 1200, stock: 3 })],
    ]);
    const priced = priceCart([{ productId: "prod-1", quantity: 1 }, { productId: "prod-2", quantity: 3 }], products);
    assert.equal(priced.subtotalCents, 5000 + 1200 * 3);
    assert.equal(priced.items.length, 2);
  });

  test("product not in the map throws product_not_found", () => {
    assert.throws(
      () => priceCart([{ productId: "missing", quantity: 1 }], new Map()),
      (err: unknown) => err instanceof CartValidationError && err.code === "product_not_found",
    );
  });

  test("unavailable product throws product_unavailable", () => {
    const product = fakeProduct({ available: false });
    assert.throws(
      () => priceCart([{ productId: "prod-1", quantity: 1 }], new Map([["prod-1", product]])),
      (err: unknown) => err instanceof CartValidationError && err.code === "product_unavailable",
    );
  });

  test("quantity exceeding stock throws insufficient_stock", () => {
    const product = fakeProduct({ stock: 2 });
    assert.throws(
      () => priceCart([{ productId: "prod-1", quantity: 3 }], new Map([["prod-1", product]])),
      (err: unknown) => err instanceof CartValidationError && err.code === "insufficient_stock",
    );
  });

  test("null stock means unlimited — any quantity passes", () => {
    const product = fakeProduct({ stock: null });
    const priced = priceCart([{ productId: "prod-1", quantity: 999 }], new Map([["prod-1", product]]));
    assert.equal(priced.items[0]!.quantity, 999);
  });

  test("quantity exactly equal to stock is allowed (boundary)", () => {
    const product = fakeProduct({ stock: 5 });
    const priced = priceCart([{ productId: "prod-1", quantity: 5 }], new Map([["prod-1", product]]));
    assert.equal(priced.items[0]!.quantity, 5);
  });

  test("mixed currencies in the same cart throws mixed_currency", () => {
    const products = new Map([
      ["prod-1", fakeProduct({ id: "prod-1", currency: "USD" })],
      ["prod-2", fakeProduct({ id: "prod-2", currency: "MXN" })],
    ]);
    assert.throws(
      () => priceCart([{ productId: "prod-1", quantity: 1 }, { productId: "prod-2", quantity: 1 }], products),
      (err: unknown) => err instanceof CartValidationError && err.code === "mixed_currency",
    );
  });
});
