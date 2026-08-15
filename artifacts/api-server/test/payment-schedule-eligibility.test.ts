import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPaymentAttemptStillActive } from "../src/lib/payment-schedule/eligibility";

describe("isPaymentAttemptStillActive", () => {
  test("an order created seconds ago is still active", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const createdAt = new Date("2026-08-16T11:59:50Z");
    assert.equal(isPaymentAttemptStillActive(createdAt, now), true);
  });

  test("an order just under PayPal's 3h expiry is still active", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const createdAt = new Date("2026-08-16T09:00:01Z"); // 2h59m59s ago
    assert.equal(isPaymentAttemptStillActive(createdAt, now), true);
  });

  test("an order exactly at PayPal's 3h expiry is no longer active", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const createdAt = new Date("2026-08-16T09:00:00Z"); // exactly 3h ago
    assert.equal(isPaymentAttemptStillActive(createdAt, now), false);
  });

  test("an order well past 3h (abandoned checkout) is no longer active", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const createdAt = new Date("2026-08-15T12:00:00Z"); // 24h ago
    assert.equal(isPaymentAttemptStillActive(createdAt, now), false);
  });
});
