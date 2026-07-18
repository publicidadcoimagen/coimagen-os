import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { auth, isFirstUser } from "../src/lib/auth";

// lib/auth.ts constructs the real betterAuth() instance at import time and
// isFirstUser() runs a real query through @workspace/db's `db` — stub the
// query chain's leaf (t.mock.method, auto-restored per test) instead of a
// live Postgres connection, so this exercises our actual config (schema
// mapping, additionalFields, the databaseHooks role rule).

describe("lib/auth config", () => {
  test("constructs the betterAuth() instance without throwing", () => {
    assert.equal(typeof auth.api.signInEmail, "function");
    assert.equal(typeof auth.api.getSession, "function");
  });

  test("isFirstUser() is true when the users table is empty", async (t) => {
    t.mock.method(db, "select", () => ({
      from: () => ({
        limit: async () => [],
      }),
    }));

    assert.equal(await isFirstUser(), true);
  });

  test("isFirstUser() is false once at least one user exists", async (t) => {
    t.mock.method(db, "select", () => ({
      from: () => ({
        limit: async () => [{ id: "existing-user" }],
      }),
    }));

    assert.equal(await isFirstUser(), false);
  });
});
