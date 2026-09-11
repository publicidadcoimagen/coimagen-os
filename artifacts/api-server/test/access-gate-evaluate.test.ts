import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateAccessGate } from "../src/lib/access-gate/evaluate";

const NOW = new Date("2026-09-10T00:00:00Z");
const past_due = { status: "past_due", updatedAt: NOW, createdAt: new Date("2026-01-01T00:00:00Z") };

describe("evaluateAccessGate", () => {
  test("exempt client is always full access, even with a past_due subscription", () => {
    const state = evaluateAccessGate(true, past_due);
    assert.equal(state.access, "full");
    assert.equal(state.causeCode, null);
  });

  test("no subscription row at all — full access, nothing to restrict", () => {
    const state = evaluateAccessGate(false, null);
    assert.equal(state.access, "full");
  });

  test("active subscription — full access", () => {
    const state = evaluateAccessGate(false, { status: "active", updatedAt: NOW, createdAt: NOW });
    assert.equal(state.access, "full");
  });

  test("past_due subscription — restricted with the confirmed cause code", () => {
    const state = evaluateAccessGate(false, past_due);
    assert.equal(state.access, "restricted");
    assert.equal(state.causeCode, "subscription_past_due");
    assert.deepEqual(state.since, NOW);
  });

  test("cancelled subscription does NOT restrict — that's día 7/15 territory, not built yet", () => {
    const state = evaluateAccessGate(false, { status: "cancelled", updatedAt: NOW, createdAt: NOW });
    assert.equal(state.access, "full");
  });

  test("pending_authorization does NOT restrict — never actually billed yet", () => {
    const state = evaluateAccessGate(false, { status: "pending_authorization", updatedAt: null, createdAt: NOW });
    assert.equal(state.access, "full");
  });

  test("past_due with no updatedAt falls back to createdAt for 'since'", () => {
    const createdAt = new Date("2026-02-01T00:00:00Z");
    const state = evaluateAccessGate(false, { status: "past_due", updatedAt: null, createdAt });
    assert.deepEqual(state.since, createdAt);
  });
});
