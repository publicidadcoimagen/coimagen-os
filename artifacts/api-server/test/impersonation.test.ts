import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { isSessionUsable, isMutatingMethod, swapToClientRole } from "../src/lib/impersonation/session";
import { impersonationMiddleware } from "../src/middlewares/impersonation";
import { getCurrentAuthUser } from "../src/routes/auth";

const NOW = new Date("2026-09-07T12:00:00Z");
const MINUTE = 60 * 1000;

describe("isSessionUsable", () => {
  test("no session — not usable", () => {
    assert.equal(isSessionUsable(undefined, NOW), false);
    assert.equal(isSessionUsable(null, NOW), false);
  });

  test("valid, unexpired, not ended — usable", () => {
    assert.equal(isSessionUsable({ endedAt: null, expiresAt: new Date(NOW.getTime() + 10 * MINUTE) }, NOW), true);
  });

  test("explicitly ended — not usable, even if not yet expired", () => {
    assert.equal(isSessionUsable({ endedAt: new Date(NOW.getTime() - MINUTE), expiresAt: new Date(NOW.getTime() + 10 * MINUTE) }, NOW), false);
  });

  test("expired — not usable, even if never explicitly ended", () => {
    assert.equal(isSessionUsable({ endedAt: null, expiresAt: new Date(NOW.getTime() - MINUTE) }, NOW), false);
  });

  test("exactly at expiresAt — not usable", () => {
    assert.equal(isSessionUsable({ endedAt: null, expiresAt: NOW }, NOW), false);
  });

  test("one second before expiresAt — usable", () => {
    assert.equal(isSessionUsable({ endedAt: null, expiresAt: new Date(NOW.getTime() + 1000) }, NOW), true);
  });
});

describe("isMutatingMethod", () => {
  test("GET is not mutating", () => {
    assert.equal(isMutatingMethod("GET"), false);
  });

  test("POST/PATCH/PUT/DELETE are mutating", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      assert.equal(isMutatingMethod(method), true);
    }
  });
});

describe("swapToClientRole", () => {
  test("narrows role to cliente and sets clientId, preserving other fields", () => {
    const staffUser = { id: "staff-1", email: "camila@coimagenmedia.com", role: "ceo", clientId: null };
    const swapped = swapToClientRole(staffUser, 42);
    assert.equal(swapped.role, "cliente");
    assert.equal(swapped.clientId, 42);
    assert.equal(swapped.id, "staff-1");
    assert.equal(swapped.email, "camila@coimagenmedia.com");
  });

  test("does not mutate the original staff user object", () => {
    const staffUser = { id: "staff-1", role: "admin", clientId: null };
    swapToClientRole(staffUser, 7);
    assert.equal(staffUser.role, "admin");
    assert.equal(staffUser.clientId, null);
  });

  test("defaults enabledModules to [] when not given — never carries over the staff's own value", () => {
    const staffUser = { id: "staff-1", role: "ceo", clientId: null, enabledModules: ["should-not-leak"] };
    const swapped = swapToClientRole(staffUser, 5);
    assert.deepEqual(swapped.enabledModules, []);
  });
});

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

// Reproduces the real bug (root-caused 2026-09-09, Becky Beck's Catálogo
// module disappearing under "Ver como cliente"): GET /api/auth/user is
// registered directly on the Express app, outside routes/index.ts's
// router — impersonationMiddleware only reached it once app.ts's route
// registration was changed to run it inline (see app.ts). These tests
// exercise that exact composition — impersonationMiddleware followed by
// getCurrentAuthUser, the same two functions app.ts chains — rather than
// either one in isolation, so a future accidental de-composition of that
// chain would fail here too.
describe("impersonationMiddleware + GET /auth/user (the composed /api/auth/user route)", () => {
  test("bug reproduction: with an active impersonation token, the response reflects the client's role and real enabledModules — not the staff's own", async (t) => {
    const staffUser = {
      id: "staff-1", email: "camila@coimagenmedia.com", firstName: "Camila", lastName: "Segovia",
      profileImageUrl: null, role: "ceo", status: "active", forcePasswordReset: false,
      lastLogin: null, clientId: null, enabledModules: [] as string[],
    };
    const sessionRow = { clientId: 5, endedAt: null, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    const clientRow = { enabledModules: ["ecommerce"] };
    let call = 0;
    // impersonationMiddleware makes exactly two sequential db.select() calls
    // (the session lookup, then the client's enabledModules lookup) —
    // mocking by call order matches that real sequence without needing a
    // real Postgres connection, same boundary-mocking approach auth-flow.test.ts
    // uses for auth.api.getSession.
    t.mock.method(
      db,
      "select",
      (() => ({ from: () => ({ where: async () => (call++ === 0 ? [sessionRow] : [clientRow]) }) })) as unknown as typeof db.select,
    );

    const req = {
      headers: { "x-impersonate-token": "tok-123" },
      method: "GET",
      user: staffUser,
      isAuthenticated: () => true,
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await impersonationMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, "impersonationMiddleware should call next() for a valid session on a GET request");

    await getCurrentAuthUser(req, res);

    const body = res.body as { user: { role: string; clientId: number; enabledModules: string[] } };
    assert.equal(body.user.role, "cliente");
    assert.equal(body.user.clientId, 5);
    assert.deepEqual(body.user.enabledModules, ["ecommerce"]);
    assert.notEqual(body.user.role, staffUser.role);
  });

  test("no impersonation token: staff sees their own unmodified session — no regression for normal staff use", async () => {
    const staffUser = {
      id: "staff-1", email: "camila@coimagenmedia.com", firstName: "Camila", lastName: "Segovia",
      profileImageUrl: null, role: "ceo", status: "active", forcePasswordReset: false,
      lastLogin: null, clientId: null, enabledModules: [] as string[],
    };
    const req = { headers: {}, method: "GET", user: staffUser, isAuthenticated: () => true } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await impersonationMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user, staffUser, "no token means impersonationMiddleware must not touch req.user at all");

    await getCurrentAuthUser(req, res);
    assert.deepEqual((res.body as { user: unknown }).user, staffUser);
  });

  test("a real cliente-role login (Betty's own session, no impersonation token) is untouched by this route change", async () => {
    // Two independent guards inside impersonationMiddleware already cover
    // this case (missing token short-circuits first; "cliente" isn't in the
    // ["ceo","admin"] allowlist either) — this test exists so that fact is
    // asserted, not just inferred from reading the guard conditions.
    const bettyUser = {
      id: "client-becky", email: "betty@beckybeck.com", firstName: "Betty", lastName: "Beck",
      profileImageUrl: null, role: "cliente", status: "active", forcePasswordReset: false,
      lastLogin: null, clientId: 5, enabledModules: ["ecommerce"],
    };
    const req = { headers: {}, method: "GET", user: bettyUser, isAuthenticated: () => true } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await impersonationMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user, bettyUser, "Betty's own real session must never be swapped by this middleware");

    await getCurrentAuthUser(req, res);
    assert.deepEqual((res.body as { user: unknown }).user, bettyUser);
  });
});
