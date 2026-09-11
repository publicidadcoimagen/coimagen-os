import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { getClientSessionExtras } from "../src/lib/access-gate/session-extras";

function mockJoinedSelect(t: import("node:test").TestContext, rows: Record<string, unknown>[]) {
  t.mock.method(db, "select", (() => {
    const chain = {
      from: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => { rows = rows.slice(0, n); return chain; },
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }) as unknown as typeof db.select);
}

describe("getClientSessionExtras", () => {
  test("no client row at all (e.g. bad clientId) — empty modules, full access", async (t) => {
    mockJoinedSelect(t, []);
    const extras = await getClientSessionExtras(999);
    assert.deepEqual(extras.enabledModules, []);
    assert.equal(extras.accessGate.access, "full");
  });

  test("exempt client with a past_due subscription — full access, real enabledModules", async (t) => {
    mockJoinedSelect(t, [{
      enabledModules: ["autopublicador"], accessGateExempt: true,
      // Safely past the 5-day threshold regardless of when the suite runs
      // — getClientSessionExtras evaluates against the real wall clock.
      subStatus: "past_due", subUpdatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), subCreatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    }]);
    const extras = await getClientSessionExtras(2);
    assert.deepEqual(extras.enabledModules, ["autopublicador"]);
    assert.equal(extras.accessGate.access, "full");
  });

  test("non-exempt client, no subscription row — LEFT JOIN gives null subscription columns, full access", async (t) => {
    mockJoinedSelect(t, [{
      enabledModules: [], accessGateExempt: false,
      subStatus: null, subUpdatedAt: null, subCreatedAt: null,
    }]);
    const extras = await getClientSessionExtras(10);
    assert.equal(extras.accessGate.access, "full");
  });

  test("non-exempt client, most recent subscription past_due — restricted", async (t) => {
    mockJoinedSelect(t, [{
      enabledModules: ["ecommerce"], accessGateExempt: false,
      // Safely past the 5-day threshold regardless of when the suite runs
      // — getClientSessionExtras evaluates against the real wall clock.
      subStatus: "past_due", subUpdatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), subCreatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    }]);
    const extras = await getClientSessionExtras(7);
    assert.equal(extras.accessGate.access, "restricted");
    assert.equal(extras.accessGate.causeCode, "subscription_past_due");
    assert.deepEqual(extras.enabledModules, ["ecommerce"]);
  });
});
