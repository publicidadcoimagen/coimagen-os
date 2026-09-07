import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { currentMonthRange } from "../src/lib/provider-costs/neon";

// The actual fetch*() functions in this module make real HTTP calls to
// Netlify/Render/Neon and are deliberately not mocked here (this repo's
// no-real-spend/no-DB test policy for external-API modules — see
// social-autopublisher.test.ts). They were exercised manually against real
// accounts during development: Netlify's /v1/accounts and Render's
// /v1/services both returned real 200s with real plan/service data; Neon's
// consumption endpoint could not be exercised (no NEON_API_KEY provisioned
// yet). This covers the one pure helper in the module.

describe("currentMonthRange", () => {
  test("returns the first instant of this UTC month through the first instant of next month", () => {
    const { from, to } = currentMonthRange();
    const now = new Date();
    const expectedFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const expectedTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    assert.equal(from, expectedFrom);
    assert.equal(to, expectedTo);
    assert.ok(new Date(from) < new Date(to));
  });
});
