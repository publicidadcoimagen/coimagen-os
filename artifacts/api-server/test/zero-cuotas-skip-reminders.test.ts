// A $0 cuota (pro-bono) in status "sent" must never feed the invoice
// reminder or payment-recovery crons. Real-Postgres (PGlite, embedded —
// never Neon) runs of the exact selection queries both crons use.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { unpaidInvoicesWithClient } from "../src/lib/invoice-reminders/repository";
import { unpaidDepositInvoicesWithClient } from "../src/lib/payment-recovery/repository";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;
type Db = Parameters<typeof unpaidInvoicesWithClient>[0];

before(async () => {
  pglite = new PGlite();
  await pglite.exec(generateSchemaSql(["clientsTable", "prospectsTable", "proposalsTable", "invoicesTable"]));
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());
beforeEach(async () => {
  await testDb.delete(schema.invoicesTable);
  await testDb.delete(schema.proposalsTable);
  await testDb.delete(schema.clientsTable);
});

// Two proposals, each with a "sent" deposit past due: one $0 (pro-bono),
// one real $500.
async function seed() {
  const [client] = await testDb.insert(schema.clientsTable).values({ name: "Cliente", email: "c@x.com" }).returning();
  const [zeroProposal] = await testDb.insert(schema.proposalsTable).values({ title: "Pro-bono", clientId: client.id, status: "accepted", amount: "0" }).returning();
  const [realProposal] = await testDb.insert(schema.proposalsTable).values({ title: "Real", clientId: client.id, status: "accepted", amount: "1000" }).returning();
  const base = { clientId: client.id, status: "sent", dueDate: "2026-01-01", currency: "MXN", publicToken: crypto.randomUUID() };
  await testDb.insert(schema.invoicesTable).values({ ...base, number: "P1-1", amount: "0", proposalId: zeroProposal.id });
  await testDb.insert(schema.invoicesTable).values({ ...base, number: "P2-1", amount: "500", proposalId: realProposal.id, publicToken: crypto.randomUUID() });
}

describe("$0 cuotas never reach the reminder / recovery crons", () => {
  test("invoice reminders: only the $500 sent invoice is selected", async () => {
    await seed();
    const rows = await unpaidInvoicesWithClient(testDb as unknown as Db);
    assert.deepEqual(rows.map((r) => r.invoice.number), ["P2-1"]);
  });

  test("payment recovery: only the $500 deposit is selected", async () => {
    await seed();
    const rows = await unpaidDepositInvoicesWithClient(testDb as unknown as Db);
    assert.deepEqual(rows.map((r) => r.invoice.number), ["P2-1"]);
  });

  test("'0.00' is excluded too (numeric comparison, not string)", async () => {
    const [client] = await testDb.insert(schema.clientsTable).values({ name: "C", email: "c@x.com" }).returning();
    const [p] = await testDb.insert(schema.proposalsTable).values({ title: "t", clientId: client.id, status: "accepted", amount: "0" }).returning();
    await testDb.insert(schema.invoicesTable).values({ clientId: client.id, status: "sent", dueDate: "2026-01-01", currency: "MXN", number: "P9-1", amount: "0.00", proposalId: p.id, publicToken: crypto.randomUUID() });
    assert.deepEqual(await unpaidInvoicesWithClient(testDb as unknown as Db), []);
    assert.deepEqual(await unpaidDepositInvoicesWithClient(testDb as unknown as Db), []);
  });
});
