import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { proBonoChange } from "../src/lib/clients/pro-bono";

describe("pro-bono flag (accessGateExempt) — CEO only, changes detected for audit", () => {
  test("requests that don't touch the flag pass for any staff role", () => {
    assert.deepEqual(proBonoChange("admin", false, undefined), { allowed: true, changed: false });
  });
  test("only the CEO may grant or revoke it", () => {
    assert.deepEqual(proBonoChange("ceo", false, true), { allowed: true, changed: true });
    assert.deepEqual(proBonoChange("ceo", true, false), { allowed: true, changed: true });
    assert.deepEqual(proBonoChange("admin", false, true), { allowed: false });
    assert.deepEqual(proBonoChange("viewer", true, false), { allowed: false });
    assert.deepEqual(proBonoChange(undefined, false, true), { allowed: false });
  });
  test("setting the same value is allowed but not a change (no audit row)", () => {
    assert.deepEqual(proBonoChange("ceo", true, true), { allowed: true, changed: false });
  });
});
