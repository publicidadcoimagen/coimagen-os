import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { clientRoleGate } from "../src/middlewares/clientRoleGate";

// clientRoleGate runs before every internal router (routes/index.ts) and is
// default-deny for role="cliente": anything not explicitly allowlisted gets
// 403. These are the staff-only read models added for the CEO portal —
// a client login must never reach them.
function run(role: string, method: string, path: string): { status: number | null; nextCalled: boolean } {
  let status: number | null = null;
  let nextCalled = false;
  const req = { method, path, user: { id: "u1", role } } as unknown as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json() { return this; },
  } as unknown as Response;
  const next: NextFunction = () => { nextCalled = true; };
  clientRoleGate(req, res, next);
  return { status, nextCalled };
}

const STAFF_ONLY = [
  "/sequences/subscription-alerts",
  "/sequences/payment-recovery",
  "/clients/overview",
];

describe("clientRoleGate — new CEO-portal routes", () => {
  for (const path of STAFF_ONLY) {
    test(`cliente gets 403 on GET ${path}`, () => {
      assert.deepEqual(run("cliente", "GET", path), { status: 403, nextCalled: false });
    });
    test(`staff passes through on GET ${path}`, () => {
      for (const role of ["ceo", "admin", "viewer"]) assert.deepEqual(run(role, "GET", path), { status: null, nextCalled: true });
    });
  }

  test("sanity: an allowlisted client route still passes for cliente", () => {
    assert.deepEqual(run("cliente", "GET", "/client-approvals"), { status: null, nextCalled: true });
  });
});
