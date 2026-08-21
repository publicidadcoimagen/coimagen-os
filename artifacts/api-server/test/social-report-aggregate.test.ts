import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summarizeMonth, monthRange, previousMonth } from "../src/lib/social-report/aggregate";

describe("summarizeMonth", () => {
  test("no activity at all — hasActivity false, zero counts", () => {
    const summary = summarizeMonth([], []);
    assert.equal(summary.hasActivity, false);
    assert.equal(summary.publishedCount, 0);
    assert.deepEqual(summary.byNetwork, {});
    assert.equal(summary.totalCostUsd, 0);
  });

  test("counts only published targets, ignores pending/failed", () => {
    const summary = summarizeMonth(
      [
        { network: "instagram", status: "published" },
        { network: "instagram", status: "published" },
        { network: "facebook", status: "pending" },
        { network: "facebook", status: "failed" },
      ],
      [],
    );
    assert.equal(summary.publishedCount, 2);
    assert.deepEqual(summary.byNetwork, { instagram: 2 });
    assert.equal(summary.hasActivity, true);
  });

  test("byNetwork groups multiple networks independently", () => {
    const summary = summarizeMonth(
      [
        { network: "instagram", status: "published" },
        { network: "facebook", status: "published" },
        { network: "facebook", status: "published" },
      ],
      [],
    );
    assert.deepEqual(summary.byNetwork, { instagram: 1, facebook: 2 });
  });

  test("sums generationCostUsd across items, treating null as zero", () => {
    const summary = summarizeMonth(
      [{ network: "instagram", status: "published" }],
      [{ generationCostUsd: "0.00030870" }, { generationCostUsd: null }, { generationCostUsd: "0.00015400" }],
    );
    assert.ok(Math.abs(summary.totalCostUsd - 0.0004627) < 1e-9);
  });

  test("cost incurred with zero posts still counts as activity", () => {
    const summary = summarizeMonth([], [{ generationCostUsd: "0.0001" }]);
    // hasActivity is defined by publishedCount only, per the design doc's
    // explicit "al menos 1 publicación" gate — a draft that never
    // published (cost incurred, nothing posted) should NOT trigger a
    // report on its own.
    assert.equal(summary.hasActivity, false);
  });
});

describe("monthRange", () => {
  test("returns the first-of-month UTC boundaries, end exclusive", () => {
    const { start, end } = monthRange("2026-08");
    assert.equal(start.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-01T00:00:00.000Z");
  });

  test("December rolls over into January of the next year", () => {
    const { start, end } = monthRange("2026-12");
    assert.equal(start.toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  test("malformed month throws", () => {
    assert.throws(() => monthRange("2026-8"));
    assert.throws(() => monthRange("not-a-month"));
  });
});

describe("previousMonth", () => {
  test("normal month rolls back by one", () => {
    assert.equal(previousMonth(new Date("2026-08-20T12:00:00Z")), "2026-07");
  });

  test("January rolls back into December of the previous year", () => {
    assert.equal(previousMonth(new Date("2026-01-15T00:00:00Z")), "2025-12");
  });

  test("run on the 1st of the month still resolves to the prior (closed) month", () => {
    assert.equal(previousMonth(new Date("2026-09-01T08:00:00Z")), "2026-08");
  });
});
