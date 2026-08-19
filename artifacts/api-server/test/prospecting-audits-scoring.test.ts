import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_CHECKLIST,
  CHECKLIST_KEYS,
  MANUAL_REVIEW_KEYS,
  isPendingManualReview,
  computeScore,
  classifyTier,
  type ProspectingChecklist,
} from "../src/lib/prospecting-audits/scoring";

describe("isPendingManualReview", () => {
  test("a brand-new checklist (everything null) is pending", () => {
    assert.equal(isPendingManualReview(EMPTY_CHECKLIST), true);
  });

  test("only abandonedSocial answered → still pending (noContentPublished missing)", () => {
    assert.equal(isPendingManualReview({ ...EMPTY_CHECKLIST, abandonedSocial: true }), true);
  });

  test("only noContentPublished answered → still pending (abandonedSocial missing)", () => {
    assert.equal(isPendingManualReview({ ...EMPTY_CHECKLIST, noContentPublished: false }), true);
  });

  test("both manual keys answered (even false/false) → no longer pending, regardless of the 8 auto keys still being null", () => {
    assert.equal(
      isPendingManualReview({ ...EMPTY_CHECKLIST, abandonedSocial: false, noContentPublished: false }),
      false,
    );
  });
});

describe("computeScore", () => {
  test("all-null checklist scores 0", () => {
    assert.equal(computeScore(EMPTY_CHECKLIST), 0);
  });

  test("counts only true values, not false or null", () => {
    const checklist: ProspectingChecklist = {
      ...EMPTY_CHECKLIST,
      noWebsite: true,
      oldWebsite: false,
      slowWebsite: null,
      noGoogleBusiness: true,
      abandonedSocial: true,
      noContentPublished: false,
    };
    assert.equal(computeScore(checklist), 3);
  });

  test("all 10 keys true scores 10", () => {
    const allTrue = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])) as unknown as ProspectingChecklist;
    assert.equal(computeScore(allTrue), 10);
  });

  test("MANUAL_REVIEW_KEYS is exactly the 2 no-API items, and a subset of CHECKLIST_KEYS", () => {
    assert.deepEqual([...MANUAL_REVIEW_KEYS].sort(), ["abandonedSocial", "noContentPublished"].sort());
    for (const key of MANUAL_REVIEW_KEYS) assert.ok(CHECKLIST_KEYS.includes(key));
  });
});

describe("classifyTier — thresholds 0-2=D, 3-5=C, 6-8=B, 9-10=A", () => {
  test("0 → D", () => assert.equal(classifyTier(0), "D"));
  test("2 → D (top of D band)", () => assert.equal(classifyTier(2), "D"));
  test("3 → C (bottom of C band)", () => assert.equal(classifyTier(3), "C"));
  test("5 → C (top of C band)", () => assert.equal(classifyTier(5), "C"));
  test("6 → B (bottom of B band)", () => assert.equal(classifyTier(6), "B"));
  test("8 → B (top of B band)", () => assert.equal(classifyTier(8), "B"));
  test("9 → A (bottom of A band)", () => assert.equal(classifyTier(9), "A"));
  test("10 → A (max score)", () => assert.equal(classifyTier(10), "A"));
});
