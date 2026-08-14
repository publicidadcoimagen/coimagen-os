import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stageForDueDate } from "../src/lib/invoice-reminders/eligibility";

const TODAY = "2026-08-13";

describe("stageForDueDate", () => {
  test("due date in the past → overdue", () => {
    assert.equal(stageForDueDate("2026-08-12", TODAY, 7), "overdue");
  });

  test("due today → overdue is never triggered by today itself, but it IS within any window ≥ 0 → upcoming", () => {
    assert.equal(stageForDueDate(TODAY, TODAY, 7), "upcoming");
  });

  test("due date well past the window (7d) → nothing due yet", () => {
    assert.equal(stageForDueDate("2026-08-25", TODAY, 7), null);
  });

  test("due date exactly at the edge of a 7-day window → upcoming", () => {
    assert.equal(stageForDueDate("2026-08-20", TODAY, 7), "upcoming");
  });

  test("due date one day past a 7-day window → nothing due yet", () => {
    assert.equal(stageForDueDate("2026-08-21", TODAY, 7), null);
  });

  test("due date within a tighter 3-day window (client reminders)", () => {
    assert.equal(stageForDueDate("2026-08-16", TODAY, 3), "upcoming");
    assert.equal(stageForDueDate("2026-08-17", TODAY, 3), null);
  });

  test("a long-overdue invoice is still just 'overdue', not a separate escalation stage", () => {
    assert.equal(stageForDueDate("2026-06-01", TODAY, 7), "overdue");
  });

  test("overdue always wins over upcoming regardless of window size", () => {
    assert.equal(stageForDueDate("2026-08-01", TODAY, 30), "overdue");
  });
});
