import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cooldownActive, COOLDOWN_HOURS } from "../src/lib/anthropic-balance-alert/repository";

const NOW = new Date("2026-08-18T12:00:00Z");
const HOUR = 60 * 60 * 1000;

describe("cooldownActive", () => {
  test("never alerted before — cooldown not active", () => {
    assert.equal(cooldownActive(null, NOW), false);
  });

  test("alerted 1 hour ago — cooldown active", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 1 * HOUR), NOW), true);
  });

  test(`alerted exactly ${COOLDOWN_HOURS} hours ago — cooldown expired`, () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - COOLDOWN_HOURS * HOUR), NOW), false);
  });

  test(`alerted ${COOLDOWN_HOURS - 1} hours ago — cooldown still active`, () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - (COOLDOWN_HOURS - 1) * HOUR), NOW), true);
  });

  test("alerted 24 hours ago — cooldown long expired", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 24 * HOUR), NOW), false);
  });
});
