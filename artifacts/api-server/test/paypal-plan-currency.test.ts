import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planIdForCurrency } from "../src/lib/paypal/subscriptions";

// A PayPal plan's currency can't be overridden per subscription — an MXN
// price on a USD plan is rejected with 422 CURRENCY_MISMATCH (verified in
// sandbox 2026-10-06). Each currency must resolve to its own plan.
describe("planIdForCurrency", () => {
  test("per-currency plan wins", () => {
    const env = { PAYPAL_PLAN_ID_MXN: "P-MXN", PAYPAL_PLAN_ID_USD: "P-USD", PAYPAL_PLAN_ID: "P-LEGACY" };
    assert.equal(planIdForCurrency("MXN", env), "P-MXN");
    assert.equal(planIdForCurrency("USD", env), "P-USD");
    assert.equal(planIdForCurrency("mxn", env), "P-MXN", "currency code is case-insensitive");
  });

  test("falls back to the legacy single plan so existing config keeps working", () => {
    assert.equal(planIdForCurrency("MXN", { PAYPAL_PLAN_ID: "P-LEGACY" }), "P-LEGACY");
    assert.equal(planIdForCurrency("MXN", { PAYPAL_PLAN_ID_USD: "P-USD", PAYPAL_PLAN_ID: "P-LEGACY" }), "P-LEGACY");
  });

  test("nothing configured → null (caller raises an actionable error)", () => {
    assert.equal(planIdForCurrency("MXN", {}), null);
    assert.equal(planIdForCurrency("MXN", { PAYPAL_PLAN_ID_USD: "P-USD" }), null, "never silently uses another currency's plan");
  });
});
