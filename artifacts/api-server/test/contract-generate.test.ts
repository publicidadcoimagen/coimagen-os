// Real-Postgres (PGlite, embedded — never Neon) tests for
// generateContractFromProposal. Like prospect-conversion.test.ts notes,
// PGlite is a single connection, so two transactions queue instead of
// overlapping: this proves the sequential duplicate path, the audit row, and
// that a failure leaves nothing behind — the concurrent-click guarantee comes
// from SELECT ... FOR UPDATE on real Postgres.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { generateContractFromProposal } from "../src/lib/contracts/generate";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;
const actor = { id: "user-1", label: "Admin Uno" };
const run = (proposalId: number, type = "ecommerce") =>
  generateContractFromProposal(proposalId, type, actor, testDb as unknown as Parameters<typeof generateContractFromProposal>[3]);

before(async () => {
  pglite = new PGlite();
  await pglite.exec(generateSchemaSql(["clientsTable", "prospectsTable", "proposalsTable", "contractsTable", "auditLogsTable"]));
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());
beforeEach(async () => {
  await testDb.delete(schema.auditLogsTable);
  await testDb.delete(schema.contractsTable);
  await testDb.delete(schema.proposalsTable);
  await testDb.delete(schema.clientsTable);
});

async function seed(overrides: Partial<typeof schema.proposalsTable.$inferInsert> = {}) {
  const [client] = await testDb.insert(schema.clientsTable).values({ name: "Tienda" }).returning();
  const [proposal] = await testDb.insert(schema.proposalsTable).values({
    title: "Ecommerce", clientId: client.id, status: "accepted", amount: "99", currency: "MXN", ...overrides,
  }).returning();
  return { client, proposal };
}

describe("generateContractFromProposal — atomic + audited", () => {
  test("creates one draft contract linked to client and proposal, plus its audit row", async () => {
    const { client, proposal } = await seed();
    const result = await run(proposal.id);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contract.clientId, client.id);
    assert.equal(result.contract.proposalId, proposal.id);
    assert.equal(result.contract.amount, 9900);
    assert.equal(result.contract.status, "draft");

    const audits = await testDb.select().from(schema.auditLogsTable);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].userId, "user-1");
    assert.equal(audits[0].module, "Contratos");
    assert.match(audits[0].result ?? "", new RegExp(`Contrato #${result.contract.id} generado desde propuesta #${proposal.id}`));
  });

  test("a second request for the same proposal returns 409 with the existing id — no duplicate", async () => {
    const { proposal } = await seed();
    const first = await run(proposal.id);
    const second = await run(proposal.id);
    assert.equal(first.ok, true);
    assert.deepEqual(second, { ok: false, status: 409, error: "contract_already_exists", contractId: first.ok ? first.contract.id : -1 });
    const contracts = await testDb.select().from(schema.contractsTable).where(eq(schema.contractsTable.proposalId, proposal.id));
    assert.equal(contracts.length, 1);
    assert.equal((await testDb.select().from(schema.auditLogsTable)).length, 1, "only the successful generation is audited");
  });

  test("a test contract for the proposal doesn't block a real one", async () => {
    const { proposal, client } = await seed();
    await testDb.insert(schema.contractsTable).values({ type: "starter", title: "prueba", clientId: client.id, proposalId: proposal.id, isTest: true });
    assert.equal((await run(proposal.id)).ok, true);
  });

  test("rejects unconverted / unaccepted / missing proposals and writes nothing", async () => {
    const { proposal: unaccepted } = await seed({ status: "sent" });
    assert.deepEqual(await run(unaccepted.id), { ok: false, status: 409, error: "proposal_not_accepted" });
    const { proposal: unconverted } = await seed({ clientId: null });
    assert.deepEqual(await run(unconverted.id), { ok: false, status: 409, error: "proposal_not_converted" });
    assert.deepEqual(await run(999999), { ok: false, status: 404, error: "proposal_not_found" });
    assert.equal((await testDb.select().from(schema.contractsTable)).length, 0);
    assert.equal((await testDb.select().from(schema.auditLogsTable)).length, 0);
  });
});
