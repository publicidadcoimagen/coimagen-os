import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isTransitionToPaid } from "../src/lib/payment-schedule/on-installment-paid";

describe("isTransitionToPaid (staff mark-as-paid → same flow as PayPal)", () => {
  test("sent → paid triggers the portal/credentials flow", () => {
    assert.equal(isTransitionToPaid("sent", "paid"), true);
  });
  test("overdue and draft → paid also trigger it", () => {
    assert.equal(isTransitionToPaid("overdue", "paid"), true);
    assert.equal(isTransitionToPaid("draft", "paid"), true);
  });
  test("re-saving an already-paid invoice never re-sends anything", () => {
    assert.equal(isTransitionToPaid("paid", "paid"), false);
  });
  test("edits that don't set status to paid don't trigger it", () => {
    assert.equal(isTransitionToPaid("sent", undefined), false);
    assert.equal(isTransitionToPaid("sent", "cancelled"), false);
  });
  test("unknown invoice (no previous row) doesn't trigger it", () => {
    assert.equal(isTransitionToPaid(undefined, "paid"), false);
  });
});
