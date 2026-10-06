import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { groupByCurrency, mrrByCurrency, annualize, usdMarginPercent } from "../src/lib/currency-aggregates";

describe("currency aggregates — dashboard + revenue MRR", () => {
  test("never sums MXN and USD into one number", () => {
    const mrr = mrrByCurrency([
      { amount: "3000", billingCycle: "monthly", currency: "MXN" },
      { amount: "300", billingCycle: "monthly", currency: "USD" },
      { amount: "1000", billingCycle: "monthly", currency: "MXN" },
    ]);
    assert.deepEqual(mrr, [
      { currency: "MXN", amount: 4000 },
      { currency: "USD", amount: 300 },
    ]);
  });

  test("annual and quarterly plans count as their monthly equivalent", () => {
    const mrr = mrrByCurrency([
      { amount: "1200", billingCycle: "annual", currency: "USD" },
      { amount: "300", billingCycle: "quarterly", currency: "USD" },
    ]);
    assert.deepEqual(mrr, [{ currency: "USD", amount: 200 }]);
  });

  test("ARR is MRR x 12, per currency", () => {
    assert.deepEqual(annualize([{ currency: "MXN", amount: 4000 }, { currency: "USD", amount: 12.5 }]), [
      { currency: "MXN", amount: 48000 },
      { currency: "USD", amount: 150 },
    ]);
  });

  test("no active subscriptions → empty breakdown, not a fake $0 total", () => {
    assert.deepEqual(mrrByCurrency([]), []);
    assert.deepEqual(groupByCurrency([]), []);
  });

  test("margin only when all MRR is USD (costs are USD)", () => {
    assert.equal(usdMarginPercent([{ currency: "USD", amount: 1000 }], 250), 75);
    assert.equal(usdMarginPercent([{ currency: "MXN", amount: 1000 }], 250), null, "pesos minus dollars is meaningless");
    assert.equal(usdMarginPercent([{ currency: "MXN", amount: 1000 }, { currency: "USD", amount: 1000 }], 250), null);
    assert.equal(usdMarginPercent([], 250), null, "no revenue → no margin, not 0%");
  });
});
