import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cooldownActive, COOLDOWN_MINUTES } from "../src/lib/client-room-error-alert/repository";

const NOW = new Date("2026-08-26T12:00:00Z");
const MINUTE = 60 * 1000;

describe("cooldownActive", () => {
  test("never alerted before — cooldown not active", () => {
    assert.equal(cooldownActive(null, NOW), false);
  });

  test("alerted 1 minute ago — cooldown active", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 1 * MINUTE), NOW), true);
  });

  test(`alerted exactly ${COOLDOWN_MINUTES} minutes ago — cooldown expired`, () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - COOLDOWN_MINUTES * MINUTE), NOW), false);
  });

  test(`alerted ${COOLDOWN_MINUTES - 1} minutes ago — cooldown still active`, () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - (COOLDOWN_MINUTES - 1) * MINUTE), NOW), true);
  });

  test("alerted 24 hours ago — cooldown long expired", () => {
    assert.equal(cooldownActive(new Date(NOW.getTime() - 24 * 60 * MINUTE), NOW), false);
  });
});
