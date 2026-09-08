import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cooldownActive } from "../src/lib/agent-escalation/repository";

const NOW = new Date("2026-09-08T12:00:00Z");
const MINUTE = 60 * 1000;

describe("cooldownActive", () => {
  test("never fired before — cooldown not active", () => {
    assert.equal(cooldownActive(null, 15, NOW), false);
  });

  test("fired 5 minutes ago, 15-minute window — cooldown active", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 5 * MINUTE), 15, NOW), true);
  });

  test("fired exactly 15 minutes ago, 15-minute window — cooldown expired", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 15 * MINUTE), 15, NOW), false);
  });

  test("fired 20 minutes ago, 15-minute window — cooldown expired", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 20 * MINUTE), 15, NOW), false);
  });

  test("same key, different window (60 min for spike alerts) — still active at 20 minutes", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 20 * MINUTE), 60, NOW), true);
  });

  test("stored value that fails to parse as a date — treated as never fired", () => {
    assert.equal(cooldownActive(new Date("not-a-real-date"), 15, NOW), false);
  });
});
