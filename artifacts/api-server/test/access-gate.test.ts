import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, clientsTable, subscriptionsTable, accessGateTicketsTable } from "@workspace/db";
import { getAccessGateState, createOrGetAccessGateTicket } from "../src/lib/access-gate/repository";
import { accessGateStatusHandler, accessGateTicketHandler } from "../src/routes/access-gate";

interface Chain<T> {
  where: () => Chain<T>;
  orderBy: () => Chain<T>;
  limit: (n: number) => Chain<T>;
  then: (resolve: (v: T[]) => void) => void;
}

function makeChain<T>(rows: T[]): Chain<T> {
  let current = rows;
  const chain: Chain<T> = {
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => { current = current.slice(0, n); return chain; },
    then: (resolve) => resolve(current),
  };
  return chain;
}

function mockDb(t: import("node:test").TestContext, opts: {
  client?: Record<string, unknown> | null;
  subscriptions?: Record<string, unknown>[];
  existingTicket?: Record<string, unknown> | null;
  uniqueViolationOnce?: boolean;
}) {
  const insertCalls: { table: unknown; values: Record<string, unknown> }[] = [];
  let uniqueViolationRemaining = opts.uniqueViolationOnce ? 1 : 0;

  t.mock.method(db, "select", (() => ({
    from: (table: unknown) => {
      if (table === clientsTable) return makeChain(opts.client ? [opts.client] : []);
      if (table === subscriptionsTable) return makeChain(opts.subscriptions ?? []);
      if (table === accessGateTicketsTable) return makeChain(opts.existingTicket ? [opts.existingTicket] : []);
      return makeChain([]);
    },
  })) as unknown as typeof db.select);

  t.mock.method(db, "insert", ((table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      insertCalls.push({ table, values });
      const result = Promise.resolve(undefined) as unknown as { returning: () => Promise<Record<string, unknown>[]> };
      result.returning = async () => {
        if (uniqueViolationRemaining > 0) {
          uniqueViolationRemaining -= 1;
          const err = new Error("duplicate key value violates unique constraint") as Error & { code: string };
          err.code = "23505";
          throw err;
        }
        return [{ id: 1, createdAt: new Date("2026-09-10T12:00:00Z"), ...values }];
      };
      return result;
    },
  })) as unknown as typeof db.insert);

  return { insertCalls };
}

const ACTIVE_CLIENT = { accessGateExempt: false };
const EXEMPT_CLIENT = { accessGateExempt: true };
const PAST_DUE_SUB = { status: "past_due", updatedAt: new Date("2026-09-05T00:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z") };

describe("getAccessGateState", () => {
  test("no such client — null", async (t) => {
    mockDb(t, { client: null });
    const state = await getAccessGateState(999);
    assert.equal(state, null);
  });

  test("exempt client — full, even with a past_due subscription on record", async (t) => {
    mockDb(t, { client: EXEMPT_CLIENT, subscriptions: [PAST_DUE_SUB] });
    const state = await getAccessGateState(2);
    assert.equal(state!.access, "full");
  });

  test("non-exempt client, most recent subscription past_due — restricted", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT, subscriptions: [PAST_DUE_SUB] });
    const state = await getAccessGateState(7);
    assert.equal(state!.access, "restricted");
    assert.equal(state!.causeCode, "subscription_past_due");
  });
});

describe("createOrGetAccessGateTicket", () => {
  test("first call creates a new ticket", async (t) => {
    const { insertCalls } = mockDb(t, { existingTicket: null });
    const ticket = await createOrGetAccessGateTicket({
      clientId: 7, causeCode: "subscription_past_due", blockedAction: "content_publish",
      source: "content-intelligence-os", idempotencyKey: "7:subscription_past_due:2026-09-05",
    });
    assert.equal(ticket.deduped, false);
    assert.equal(insertCalls.length, 1);
  });

  test("same idempotency key already recorded — returns the existing folio, no insert", async (t) => {
    const { insertCalls } = mockDb(t, {
      existingTicket: { id: 1, clientId: 7, causeCode: "subscription_past_due", createdAt: new Date("2026-09-05T00:00:00Z") },
    });
    const ticket = await createOrGetAccessGateTicket({
      clientId: 7, causeCode: "subscription_past_due", blockedAction: null,
      source: "content-intelligence-os", idempotencyKey: "7:subscription_past_due:2026-09-05",
    });
    assert.equal(ticket.deduped, true);
    assert.equal(ticket.id, 1);
    assert.equal(insertCalls.length, 0);
  });

  test("concurrent duplicate insert (unique violation) recovers by re-reading, not by crashing", async (t) => {
    // First select misses (nothing recorded yet), the insert then loses a
    // race to a concurrent request — simulated by uniqueViolationOnce plus
    // a select that DOES find a row (the "winner"'s row) on the retry.
    // insert must be mocked first: mockDb() would otherwise re-mock
    // db.select and clobber the two-call select sequence set up below.
    mockDb(t, { uniqueViolationOnce: true });

    let calls = 0;
    t.mock.method(db, "select", (() => ({
      from: (table: unknown) => {
        if (table === accessGateTicketsTable) {
          calls += 1;
          const found = calls > 1 ? [{ id: 5, clientId: 7, causeCode: "subscription_past_due", createdAt: new Date("2026-09-05T00:00:00Z") }] : [];
          return makeChain(found);
        }
        return makeChain([]);
      },
    })) as unknown as typeof db.select);

    const ticket = await createOrGetAccessGateTicket({
      clientId: 7, causeCode: "subscription_past_due", blockedAction: null,
      source: "content-intelligence-os", idempotencyKey: "7:subscription_past_due:2026-09-05",
    });
    assert.equal(ticket.deduped, true);
    assert.equal(ticket.id, 5);
  });
});

function fakeRes() {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) { calls.status = code; return res; },
    json(body: unknown) { calls.body = body; return res; },
  };
  return { res: res as unknown as import("express").Response, calls };
}

describe("access-gate routes — auth and validation", () => {
  const ORIGINAL_KEY = process.env.ACCESS_GATE_API_KEY;
  beforeEach(() => { process.env.ACCESS_GATE_API_KEY = "test-gate-key"; });
  afterEach(() => { process.env.ACCESS_GATE_API_KEY = ORIGINAL_KEY; });

  test("status: missing/wrong X-Gate-Api-Key — 401", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT, subscriptions: [] });
    const { res, calls } = fakeRes();
    await accessGateStatusHandler({ headers: { "x-gate-api-key": "wrong" }, params: { clientId: "7" } } as unknown as import("express").Request, res);
    assert.equal(calls.status, 401);
  });

  test("status: unconfigured key on our side — 503, fails closed", async (t) => {
    process.env.ACCESS_GATE_API_KEY = "";
    mockDb(t, { client: ACTIVE_CLIENT, subscriptions: [] });
    const { res, calls } = fakeRes();
    await accessGateStatusHandler({ headers: {}, params: { clientId: "7" } } as unknown as import("express").Request, res);
    assert.equal(calls.status, 503);
  });

  test("status: correct key, non-numeric clientId — 400", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT, subscriptions: [] });
    const { res, calls } = fakeRes();
    await accessGateStatusHandler({ headers: { "x-gate-api-key": "test-gate-key" }, params: { clientId: "abc" } } as unknown as import("express").Request, res);
    assert.equal(calls.status, 400);
  });

  test("status: correct key, real client — 200 with the evaluated state", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT, subscriptions: [PAST_DUE_SUB] });
    const { res, calls } = fakeRes();
    await accessGateStatusHandler({ headers: { "x-gate-api-key": "test-gate-key" }, params: { clientId: "7" } } as unknown as import("express").Request, res);
    assert.equal(calls.status, undefined); // res.json() alone defaults Express to 200
    assert.equal((calls.body as { access: string }).access, "restricted");
  });

  test("ticket: missing Idempotency-Key header — 400", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT });
    const { res, calls } = fakeRes();
    await accessGateTicketHandler({
      headers: { "x-gate-api-key": "test-gate-key" },
      body: { clientId: 7, causeCode: "subscription_past_due", source: "content-intelligence-os" },
    } as unknown as import("express").Request, res);
    assert.equal(calls.status, 400);
  });

  test("ticket: valid request — 201 with a GATE-YYYY-NNNNN folio", async (t) => {
    mockDb(t, { client: ACTIVE_CLIENT, existingTicket: null });
    const { res, calls } = fakeRes();
    await accessGateTicketHandler({
      headers: { "x-gate-api-key": "test-gate-key", "idempotency-key": "7:subscription_past_due:2026-09-05" },
      body: { clientId: 7, causeCode: "subscription_past_due", blockedAction: "content_publish", source: "content-intelligence-os" },
    } as unknown as import("express").Request, res);
    assert.equal(calls.status, 201);
    assert.match((calls.body as { ticketId: string }).ticketId, /^GATE-2026-\d{5}$/);
  });
});
