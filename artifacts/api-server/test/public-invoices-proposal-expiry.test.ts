// Real-Postgres (PGlite) tests for isParentProposalExpired — the guard
// create-paypal-order now runs before starting a new PayPal charge. Before
// this fix, an already-accepted proposal past its validUntil kept accepting
// payments indefinitely (nothing checked validUntil anywhere in the public
// payment path, only invoices.status). Isolated to this pure DB check
// rather than a full route test, since the route itself also calls the real
// PayPal SDK (createOrder) which isn't mocked anywhere in this suite yet.
//
// Schema below is generated from the real table definitions (not
// hand-copied SQL) — see lib/db/src/testing/generate-schema-sql.ts.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { isParentProposalExpired } from "../src/routes/public-invoices";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedProposal(overrides: Partial<typeof schema.proposalsTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.proposalsTable).values({
    title: "Propuesta de prueba",
    status: "accepted",
    amount: "10000",
    ...overrides,
  }).returning();
  return row;
}

before(async () => {
  pglite = new PGlite();
  const sql = generateSchemaSql(["clientsTable", "prospectsTable", "proposalsTable", "invoicesTable"]);
  await pglite.exec(sql);
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());

describe("isParentProposalExpired", () => {
  test("validUntil en el pasado -> true", async () => {
    const proposal = await seedProposal({ validUntil: new Date("2020-01-01") });
    const expired = await isParentProposalExpired(proposal.id, testDb as unknown as Parameters<typeof isParentProposalExpired>[1]);
    assert.equal(expired, true);
  });

  test("validUntil en el futuro -> false", async () => {
    const proposal = await seedProposal({ validUntil: new Date("2099-01-01") });
    const expired = await isParentProposalExpired(proposal.id, testDb as unknown as Parameters<typeof isParentProposalExpired>[1]);
    assert.equal(expired, false);
  });

  test("sin validUntil (null) -> false, nunca vence", async () => {
    const proposal = await seedProposal({ validUntil: null });
    const expired = await isParentProposalExpired(proposal.id, testDb as unknown as Parameters<typeof isParentProposalExpired>[1]);
    assert.equal(expired, false);
  });

  test("invoice sin proposalId (proposalId null) -> false", async () => {
    const expired = await isParentProposalExpired(null, testDb as unknown as Parameters<typeof isParentProposalExpired>[1]);
    assert.equal(expired, false);
  });
});
