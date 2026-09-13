import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isDueForLatePaymentSurcharge, computeLatePaymentSurcharge, SURCHARGE_RATE } from "../src/lib/subscription-alerts/late-payment-surcharge";

const NOW = new Date("2026-08-14T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isDueForLatePaymentSurcharge", () => {
  test("just went past_due (0 days) — not due yet", () => {
    assert.equal(isDueForLatePaymentSurcharge(NOW, NOW), false);
  });

  test("2 days past_due — still not due (Día 3, not Día 2)", () => {
    assert.equal(isDueForLatePaymentSurcharge(new Date(NOW.getTime() - 2 * DAY), NOW), false);
  });

  test("exactly 3 days past_due — due", () => {
    assert.equal(isDueForLatePaymentSurcharge(new Date(NOW.getTime() - 3 * DAY), NOW), true);
  });

  test("10 days past_due — still due (dedup is handled at the repository layer, not here)", () => {
    assert.equal(isDueForLatePaymentSurcharge(new Date(NOW.getTime() - 10 * DAY), NOW), true);
  });
});

describe("computeLatePaymentSurcharge", () => {
  test("5% of the monthly amount", () => {
    assert.equal(SURCHARGE_RATE, 0.05);
    assert.equal(computeLatePaymentSurcharge(1000), 50);
  });

  test("rounds to 2 decimals", () => {
    assert.equal(computeLatePaymentSurcharge(333.33), 16.67);
  });

  test("zero amount surcharges to zero, not an error", () => {
    assert.equal(computeLatePaymentSurcharge(0), 0);
  });
});
