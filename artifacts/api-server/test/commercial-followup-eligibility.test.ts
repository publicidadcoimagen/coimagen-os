import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nextStageToSend } from "../src/lib/commercial-followup/eligibility";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-08T12:00:00Z");

describe("nextStageToSend", () => {
  test("a brand-new lead (day 0) isn't due for anything yet", () => {
    assert.equal(nextStageToSend(NOW, NOW, new Set()), null);
  });

  test("day 1, untouched → correo 2", () => {
    const createdAt = new Date(NOW.getTime() - 1 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set()), 2);
  });

  test("day 2, correo 2 already sent → not yet due for correo 3", () => {
    const createdAt = new Date(NOW.getTime() - 2 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set([2])), null);
  });

  test("day 3, correo 2 already sent → correo 3 due", () => {
    const createdAt = new Date(NOW.getTime() - 3 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set([2])), 3);
  });

  test("day 6, correo 2+3 already sent → correo 4 due", () => {
    const createdAt = new Date(NOW.getTime() - 6 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set([2, 3])), 4);
  });

  test("all 4 stages sent → sequence is over, nothing else fires", () => {
    const createdAt = new Date(NOW.getTime() - 30 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set([2, 3, 4])), null);
  });

  test("a very stale lead (20 days, never touched) only gets ONE stage this run — correo 2, not a 2/3/4 blast", () => {
    const createdAt = new Date(NOW.getTime() - 20 * DAY);
    assert.equal(nextStageToSend(createdAt, NOW, new Set()), 2);
  });

  test("the 14 real backlogged leads (created jul 17-26) each advance exactly one stage per run as of aug 8", () => {
    // jul 17 → 22 days old: already sent nothing yet → correo 2 (not 3 or 4)
    const jul17 = new Date("2026-07-17T10:00:00Z");
    assert.equal(nextStageToSend(jul17, NOW, new Set()), 2);
    // same lead, next run, correo 2 already sent → correo 3
    assert.equal(nextStageToSend(jul17, NOW, new Set([2])), 3);
    // jul 26 → 13 days old, same story
    const jul26 = new Date("2026-07-26T10:00:00Z");
    assert.equal(nextStageToSend(jul26, NOW, new Set()), 2);
  });
});
