import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateAccessGate } from "../src/lib/access-gate/evaluate";

const NOW = new Date("2026-09-10T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function subAt(daysAgo: number) {
  const updatedAt = new Date(NOW.getTime() - daysAgo * DAY);
  return { status: "past_due", updatedAt, createdAt: new Date("2026-01-01T00:00:00Z") };
}

describe("evaluateAccessGate", () => {
  test("exempt client is always full access, even with a long-past-due subscription", () => {
    const state = evaluateAccessGate(true, subAt(10), NOW);
    assert.equal(state.access, "full");
    assert.equal(state.causeCode, null);
  });

  test("no subscription row at all — full access, nothing to restrict", () => {
    const state = evaluateAccessGate(false, null, NOW);
    assert.equal(state.access, "full");
  });

  test("active subscription — full access", () => {
    const state = evaluateAccessGate(false, { status: "active", updatedAt: NOW, createdAt: NOW }, NOW);
    assert.equal(state.access, "full");
  });

  test("cancelled subscription does NOT restrict — that's día 7/15 territory, not built yet", () => {
    const state = evaluateAccessGate(false, { status: "cancelled", updatedAt: NOW, createdAt: NOW }, NOW);
    assert.equal(state.access, "full");
  });

  test("pending_authorization does NOT restrict — never actually billed yet", () => {
    const state = evaluateAccessGate(false, { status: "pending_authorization", updatedAt: null, createdAt: NOW }, NOW);
    assert.equal(state.access, "full");
  });

  describe("the 5-day grace period (Cláusula 9, día 5)", () => {
    test("past_due as of right now (day 0) — still full access", () => {
      const state = evaluateAccessGate(false, subAt(0), NOW);
      assert.equal(state.access, "full");
    });

    test("past_due for 3 days — still full access (día 0-4 window)", () => {
      const state = evaluateAccessGate(false, subAt(3), NOW);
      assert.equal(state.access, "full");
    });

    test("past_due for 4.9 days — still full access, one tick before the threshold", () => {
      const state = evaluateAccessGate(false, { status: "past_due", updatedAt: new Date(NOW.getTime() - 4.9 * DAY), createdAt: new Date("2026-01-01T00:00:00Z") }, NOW);
      assert.equal(state.access, "full");
    });

    test("past_due for exactly 5 days — restricted, threshold is inclusive", () => {
      const state = evaluateAccessGate(false, subAt(5), NOW);
      assert.equal(state.access, "restricted");
      assert.equal(state.causeCode, "subscription_past_due");
    });

    test("past_due for 10 days — restricted", () => {
      const state = evaluateAccessGate(false, subAt(10), NOW);
      assert.equal(state.access, "restricted");
    });

    test("restricted state's 'since' is when the subscription actually went past_due, not now", () => {
      const state = evaluateAccessGate(false, subAt(7), NOW);
      assert.deepEqual(state.since, new Date(NOW.getTime() - 7 * DAY));
    });
  });

  test("past_due with no updatedAt falls back to createdAt for the day count", () => {
    const createdAt = new Date(NOW.getTime() - 6 * DAY);
    const state = evaluateAccessGate(false, { status: "past_due", updatedAt: null, createdAt }, NOW);
    assert.equal(state.access, "restricted");
    assert.deepEqual(state.since, createdAt);
  });
});
