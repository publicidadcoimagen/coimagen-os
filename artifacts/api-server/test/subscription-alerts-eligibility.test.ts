import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isStalePendingAuthorization } from "../src/lib/subscription-alerts/eligibility";

const NOW = new Date("2026-08-14T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isStalePendingAuthorization", () => {
  test("just created (0 days) — not stale yet", () => {
    assert.equal(isStalePendingAuthorization(NOW, NOW), false);
  });

  test("2 days old — still not stale", () => {
    assert.equal(isStalePendingAuthorization(new Date(NOW.getTime() - 2 * DAY), NOW), false);
  });

  test("exactly 3 days old — stale", () => {
    assert.equal(isStalePendingAuthorization(new Date(NOW.getTime() - 3 * DAY), NOW), true);
  });

  test("10 days old — still stale (alert is one-shot, dedup handled at the repository layer, not here)", () => {
    assert.equal(isStalePendingAuthorization(new Date(NOW.getTime() - 10 * DAY), NOW), true);
  });
});
