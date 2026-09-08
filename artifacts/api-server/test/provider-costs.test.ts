import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { currentMonthRange, fetchNeonConsumption } from "../src/lib/provider-costs/neon";

// The actual fetch*() functions in this module make real HTTP calls to
// Netlify/Render/Neon and are deliberately not mocked here for Netlify/Render
// (this repo's no-real-spend/no-DB test policy for external-API modules —
// see social-autopublisher.test.ts): both were exercised manually against
// real accounts during development and returned real 200s with real
// plan/service data.
//
// Neon's consumption endpoint got a real bug that manual exercise never
// caught: it went live assuming a flat top-level "periods" array, but once
// NEON_API_KEY/NEON_ORG_ID were actually configured in production the real
// API returned "Cannot read properties of undefined (reading 'map')" —
// the true shape nests projects[].periods[].consumption[].metrics[]
// (confirmed against Neon's live OpenAPI schema for
// getConsumptionHistoryPerProjectV2). This test mocks fetch with that exact
// documented shape so the parser is checked against reality instead of an
// assumption, without spending a real Neon API call.

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

describe("fetchNeonConsumption", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.NEON_API_KEY;
  const originalOrgId = process.env.NEON_ORG_ID;

  before(() => {
    process.env.NEON_API_KEY = "test-key-not-real";
    process.env.NEON_ORG_ID = "org-test-not-real";
  });

  after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NEON_API_KEY; else process.env.NEON_API_KEY = originalKey;
    if (originalOrgId === undefined) delete process.env.NEON_ORG_ID; else process.env.NEON_ORG_ID = originalOrgId;
  });

  test("parses Neon's real nested projects[].periods[].consumption[].metrics[] shape", async () => {
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({
        projects: [
          {
            project_id: "random-project-123456",
            periods: [
              {
                period_id: "random-period-abcdef",
                period_plan: "scale",
                period_start: "2026-09-01T00:00:00Z",
                period_end: "2026-10-01T00:00:00Z",
                consumption: [
                  {
                    timeframe_start: "2026-09-01T00:00:00Z",
                    timeframe_end: "2026-10-01T00:00:00Z",
                    metrics: [
                      { metric_name: "compute_unit_seconds", value: 43222 },
                      { metric_name: "root_branch_bytes_month", value: 37000959232 },
                      { metric_name: "public_network_transfer_bytes", value: 1000 },
                      { metric_name: "private_network_transfer_bytes", value: 500 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    })) as typeof fetch;

    const result = await fetchNeonConsumption();
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    assert.deepEqual(result.consumption, [
      {
        projectId: "random-project-123456",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-10-01T00:00:00Z",
        computeUnitSeconds: 43222,
        storageBytesHour: 37000959232,
        dataTransferBytes: 1500,
      },
    ]);
  });

  test("does not crash when a project has no periods for the month", async () => {
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({ projects: [{ project_id: "empty-project", periods: [] }] }),
    })) as typeof fetch;

    const result = await fetchNeonConsumption();
    assert.equal(result.ok, true);
    assert.deepEqual(result.consumption, []);
  });
});
