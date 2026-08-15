import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nextRecoveryStageToSend, type RecoveryStage } from "../src/lib/payment-recovery/eligibility";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-08-16T12:00:00Z");

function sent(...stages: RecoveryStage[]): Set<RecoveryStage> {
  return new Set(stages);
}

describe("nextRecoveryStageToSend", () => {
  test("a brand-new invoice (0h old) isn't due for anything yet", () => {
    assert.equal(nextRecoveryStageToSend(NOW, NOW, sent()), null);
  });

  test("23h59m old, untouched — not yet due for the 24h reminder", () => {
    const createdAt = new Date(NOW.getTime() - (24 * HOUR - 60 * 1000));
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent()), null);
  });

  test("exactly 24h old, untouched → reminder_24h due", () => {
    const createdAt = new Date(NOW.getTime() - 24 * HOUR);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent()), "reminder_24h");
  });

  test("29 days old, reminder_24h already sent — not yet due for discount_30d", () => {
    const createdAt = new Date(NOW.getTime() - 29 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent("reminder_24h")), null);
  });

  test("30 days old, reminder_24h already sent → discount_30d due", () => {
    const createdAt = new Date(NOW.getTime() - 30 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent("reminder_24h")), "discount_30d");
  });

  test("60 days old, reminder_24h + discount_30d already sent → discount_60d due", () => {
    const createdAt = new Date(NOW.getTime() - 60 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent("reminder_24h", "discount_30d")), "discount_60d");
  });

  test("all 3 stages sent → sequence is over, nothing else fires", () => {
    const createdAt = new Date(NOW.getTime() - 90 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent("reminder_24h", "discount_30d", "discount_60d")), null);
  });

  test("a very stale invoice (90 days, never touched) only gets ONE stage this run — reminder_24h, not a 3-stage blast", () => {
    const createdAt = new Date(NOW.getTime() - 90 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent()), "reminder_24h");
  });

  test("never advances two stages in one run even if both are technically overdue", () => {
    // 90 days old, only reminder_24h sent so far — discount_60d is also
    // "overdue" by day count, but discount_30d must go out first.
    const createdAt = new Date(NOW.getTime() - 90 * DAY);
    assert.equal(nextRecoveryStageToSend(createdAt, NOW, sent("reminder_24h")), "discount_30d");
  });
});
