// Real-Postgres (PGlite, embedded — never Neon) tests for POST
// /clients/:id/portal-access/resend's logic. The Resend email is an
// injected fake; the password hash is Better Auth's real one, verified back.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { auth } from "../src/lib/auth";
import { resendPortalAccess, type ResendPortalAccessDeps } from "../src/lib/portal-onboarding/resend-portal-access";
import { requireRole } from "../src/middlewares/requireAuth";
import { clientRoleGate } from "../src/middlewares/clientRoleGate";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;
const actor = { id: "staff-1", label: "Camila" };
let emailed: { email: string; name: string; password: string }[];

function deps(overrides: Partial<ResendPortalAccessDeps> = {}): ResendPortalAccessDeps {
  return {
    db: testDb as unknown as ResendPortalAccessDeps["db"],
    hashPassword: async (p) => (await auth.$context).password.hash(p),
    sendCredentials: async (email, name, password) => { emailed.push({ email, name, password }); return "email-id"; },
    ...overrides,
  };
}

async function audits() {
  return testDb.select().from(schema.auditLogsTable);
}

// A client with a cliente login, an old credential and two open sessions.
async function seedClientWithLogin() {
  const [c] = await testDb.insert(schema.clientsTable).values({ name: "building levis", email: "ropa@x.com" }).returning();
  const [u] = await testDb.insert(schema.usersTable).values({ id: "user-26", email: "ropa@x.com", role: "cliente", clientId: c.id, forcePasswordReset: false }).returning();
  await testDb.insert(schema.accountsTable).values({ id: "acc-1", userId: u.id, accountId: u.id, providerId: "credential", password: "old-hash" });
  const later = new Date(Date.now() + 86_400_000);
  await testDb.insert(schema.sessionsTable).values([
    { id: "s1", userId: u.id, token: "t1", expiresAt: later },
    { id: "s2", userId: u.id, token: "t2", expiresAt: later },
  ]);
  return { client: c, user: u };
}

before(async () => {
  pglite = new PGlite({ extensions: { pgcrypto } });
  await pglite.exec("create extension if not exists pgcrypto;");
  await pglite.exec(generateSchemaSql(["clientsTable", "usersTable", "accountsTable", "sessionsTable", "auditLogsTable"]));
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());
beforeEach(async () => {
  emailed = [];
  await testDb.delete(schema.auditLogsTable);
  await testDb.delete(schema.sessionsTable);
  await testDb.delete(schema.accountsTable);
  await testDb.delete(schema.usersTable);
  await testDb.delete(schema.clientsTable);
});

describe("resendPortalAccess — new temporary password, forced change, sessions ended, audited", () => {
  test("404 client_not_found — audited, nothing sent", async () => {
    assert.deepEqual(await resendPortalAccess(999999, actor, deps()), { ok: false, status: 404, error: "client_not_found" });
    assert.deepEqual(emailed, []);
    const [row] = await audits();
    assert.equal(row.action, "Reenviar acceso al portal");
    assert.equal(row.status, "failure");
    assert.match(row.result ?? "", /client_not_found/);
  });

  test("404 no_portal_account when the client never got a login", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Sin acceso", email: "s@x.com" }).returning();
    assert.deepEqual(await resendPortalAccess(c.id, actor, deps()), { ok: false, status: 404, error: "no_portal_account" });
    assert.deepEqual(emailed, []);
    assert.match((await audits())[0].result ?? "", /no_portal_account/);
  });

  test("success: real Better Auth hash of the emailed password, force reset on, sessions gone, same single login", async () => {
    const { client, user } = await seedClientWithLogin();
    assert.deepEqual(await resendPortalAccess(client.id, actor, deps()), { ok: true, emailSent: true });

    assert.equal(emailed.length, 1);
    assert.equal(emailed[0].email, "ropa@x.com");
    const sent = emailed[0].password;
    assert.ok(sent.length >= 8);

    const accounts = await testDb.select().from(schema.accountsTable).where(eq(schema.accountsTable.userId, user.id));
    assert.equal(accounts.length, 1, "credential row replaced, not duplicated");
    assert.notEqual(accounts[0].password, "old-hash");
    const ctx = await auth.$context;
    assert.equal(await ctx.password.verify({ hash: accounts[0].password!, password: sent }), true);

    const [after] = await testDb.select().from(schema.usersTable).where(eq(schema.usersTable.id, user.id));
    assert.equal(after.forcePasswordReset, true);
    assert.equal((await testDb.select().from(schema.sessionsTable)).length, 0, "old sessions ended");
    assert.equal((await testDb.select().from(schema.usersTable)).length, 1, "no second portal user");

    const [row] = await audits();
    assert.equal(row.status, "success");
    assert.match(row.result ?? "", /credenciales enviadas/);
    assert.match(row.metadata ?? "", /"emailSent":true/);
    assert.ok(!(row.metadata ?? "").includes(sent) && !(row.result ?? "").includes(sent), "password never in the audit row");
  });

  test("each resend issues a different password", async () => {
    const { client } = await seedClientWithLogin();
    await resendPortalAccess(client.id, actor, deps());
    await resendPortalAccess(client.id, actor, deps());
    assert.equal(emailed.length, 2);
    assert.notEqual(emailed[0].password, emailed[1].password);
  });

  test("a login without a credential row gets one", async () => {
    const { client, user } = await seedClientWithLogin();
    await testDb.delete(schema.accountsTable);
    assert.deepEqual(await resendPortalAccess(client.id, actor, deps()), { ok: true, emailSent: true });
    const accounts = await testDb.select().from(schema.accountsTable).where(eq(schema.accountsTable.userId, user.id));
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].providerId, "credential");
  });

  test("email failure keeps the reset, reports emailSent:false, audited", async () => {
    const { client } = await seedClientWithLogin();
    const result = await resendPortalAccess(client.id, actor, deps({ sendCredentials: async () => { throw new Error("resend down"); } }));
    assert.deepEqual(result, { ok: true, emailSent: false });
    assert.match((await audits())[0].result ?? "", /correo falló/);
  });
});

describe("POST /clients/:id/portal-access/resend — who can call it", () => {
  test("requireRole: ceo and admin pass; viewer and cliente 403; no session 401", () => {
    const guard = requireRole("ceo", "admin");
    function run(role: string | null) {
      let status: number | null = null;
      let passed = false;
      const req = { isAuthenticated: () => role !== null, user: role ? { id: "u", role } : undefined } as unknown as Request;
      const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
      guard(req, res, (() => { passed = true; }) as NextFunction);
      return { status, passed };
    }
    assert.deepEqual(run("ceo"), { status: null, passed: true });
    assert.deepEqual(run("admin"), { status: null, passed: true });
    assert.deepEqual(run("viewer"), { status: 403, passed: false });
    assert.deepEqual(run("cliente"), { status: 403, passed: false });
    assert.deepEqual(run(null), { status: 401, passed: false });
  });

  test("clientRoleGate blocks a cliente login before the route", () => {
    let status: number | null = null;
    let nextCalled = false;
    const req = { method: "POST", path: "/clients/26/portal-access/resend", user: { id: "u", role: "cliente" } } as unknown as Request;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
    clientRoleGate(req, res, (() => { nextCalled = true; }) as NextFunction);
    assert.deepEqual({ status, nextCalled }, { status: 403, nextCalled: false });
  });
});
