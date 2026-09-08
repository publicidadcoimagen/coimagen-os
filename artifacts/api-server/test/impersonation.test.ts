import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isSessionUsable, isMutatingMethod, swapToClientRole } from "../src/lib/impersonation/session";

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
});
