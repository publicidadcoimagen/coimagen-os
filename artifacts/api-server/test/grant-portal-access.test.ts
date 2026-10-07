// Real-Postgres (PGlite, embedded — never Neon) tests for POST
// /clients/:id/portal-access's logic. Better Auth account creation and the
// Resend email are injected fakes: these tests prove the checks, the error
// codes and the audit trail, not credential hashing.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { grantPortalAccess, type GrantPortalAccessDeps } from "../src/lib/portal-onboarding/grant-portal-access";
import { requireRole } from "../src/middlewares/requireAuth";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;
const actor = { id: "staff-1", label: "Admin Uno" };
let calls: { room: number[]; created: number[]; emailed: string[] };

function deps(overrides: Partial<GrantPortalAccessDeps> = {}): GrantPortalAccessDeps {
  return {
    db: testDb as unknown as GrantPortalAccessDeps["db"],
    ensureRoom: async (clientId) => { calls.room.push(clientId); },
    createAccount: async (clientId) => { calls.created.push(clientId); return { temporaryPassword: "tmp-pass-123" }; },
    sendCredentials: async (email) => { calls.emailed.push(email); return "email-id"; },
    ...overrides,
  };
}

async function audits() {
  return testDb.select().from(schema.auditLogsTable);
}

before(async () => {
  pglite = new PGlite({ extensions: { pgcrypto } });
  await pglite.exec("create extension if not exists pgcrypto;");
  await pglite.exec(generateSchemaSql(["clientsTable", "usersTable", "auditLogsTable"]));
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());
beforeEach(async () => {
  calls = { room: [], created: [], emailed: [] };
  await testDb.delete(schema.auditLogsTable);
  await testDb.delete(schema.usersTable);
  await testDb.delete(schema.clientsTable);
});

describe("grantPortalAccess — errors, success and audit trail", () => {
  test("404 for a client that doesn't exist — audited, nothing created", async () => {
    assert.deepEqual(await grantPortalAccess(999999, actor, deps()), { ok: false, status: 404, error: "client_not_found" });
    assert.deepEqual(calls.created, []);
    const [row] = await audits();
    assert.equal(row.userId, "staff-1");
    assert.equal(row.status, "failure");
    assert.match(row.result ?? "", /cliente #999999: client_not_found/);
  });

  test("400 for a client without email", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Sin correo" }).returning();
    assert.deepEqual(await grantPortalAccess(c.id, actor, deps()), { ok: false, status: 400, error: "client_has_no_email" });
    assert.deepEqual(calls.created, []);
    assert.match((await audits())[0].result ?? "", /client_has_no_email/);
  });

  test("409 duplicate when the client already has a cliente login", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Tienda", email: "tienda@x.com" }).returning();
    await testDb.insert(schema.usersTable).values({ email: "otro@x.com", role: "cliente", clientId: c.id });
    assert.deepEqual(await grantPortalAccess(c.id, actor, deps()), { ok: false, status: 409, error: "already_has_portal_access" });
    assert.deepEqual(calls.created, []);
    assert.deepEqual(calls.emailed, [], "no second credentials email");
  });

  test("409 email in use when another account (e.g. staff) has that email", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Tienda", email: "compartido@x.com" }).returning();
    await testDb.insert(schema.usersTable).values({ email: "compartido@x.com", role: "admin" });
    assert.deepEqual(await grantPortalAccess(c.id, actor, deps()), { ok: false, status: 409, error: "email_in_use" });
    assert.deepEqual(calls.created, []);
    assert.match((await audits())[0].result ?? "", /email_in_use/);
  });

  test("success: room ensured, account created, credentials emailed, audited as success", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Tienda", email: "tienda@x.com" }).returning();
    assert.deepEqual(await grantPortalAccess(c.id, actor, deps()), { ok: true, emailSent: true });
    assert.deepEqual(calls, { room: [c.id], created: [c.id], emailed: ["tienda@x.com"] });
    const [row] = await audits();
    assert.equal(row.status, "success");
    assert.equal(row.action, "Otorgar acceso al portal");
    assert.match(row.result ?? "", /credenciales enviadas/);
    assert.doesNotMatch(row.metadata ?? "", /tmp-pass-123/, "the temporary password never reaches the audit log");
  });

  test("email failure still creates the login, reports emailSent:false, audited", async () => {
    const [c] = await testDb.insert(schema.clientsTable).values({ name: "Tienda", email: "tienda@x.com" }).returning();
    const result = await grantPortalAccess(c.id, actor, deps({ sendCredentials: async () => { throw new Error("resend down"); } }));
    assert.deepEqual(result, { ok: true, emailSent: false });
    assert.match((await audits())[0].result ?? "", /correo falló/);
  });
});

describe("POST /clients/:id/portal-access role guard", () => {
  const guard = requireRole("ceo", "admin");
  function run(role: string | null) {
    let status: number | null = null;
    let passed = false;
    const req = { isAuthenticated: () => role !== null, user: role ? { id: "u", role } : undefined } as unknown as Request;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
    guard(req, res, (() => { passed = true; }) as NextFunction);
    return { status, passed };
  }
  test("ceo and admin pass; viewer and cliente get 403; no session gets 401", () => {
    assert.deepEqual(run("ceo"), { status: null, passed: true });
    assert.deepEqual(run("admin"), { status: null, passed: true });
    assert.deepEqual(run("viewer"), { status: 403, passed: false });
    assert.deepEqual(run("cliente"), { status: 403, passed: false });
    assert.deepEqual(run(null), { status: 401, passed: false });
  });
});
