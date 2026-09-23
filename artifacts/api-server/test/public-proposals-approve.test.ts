// Real-Postgres (PGlite) tests for the approve path's DB-touching logic —
// previously the only coverage in public-proposals.test.ts was the
// param-validation gate against a mock response, explicitly documented
// there as needing a real database for everything past it. This is exactly
// the gap that let invoices.publicToken ship null on every installment
// generated here (see payment-schedule/repository.ts's fix and
// prospect-conversion.test.ts's equivalent regression assertion for the
// OTHER caller of createInstallmentInvoices) — public-proposals.ts's
// approve endpoint is the SECOND caller, and had no equivalent assertion.
//
// Schema below is generated from the real table definitions (not
// hand-copied SQL) — see lib/db/src/testing/generate-schema-sql.ts.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { approveProposalByToken } from "../src/routes/public-proposals";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedClient(name: string) {
  const [row] = await testDb.insert(schema.clientsTable).values({ name }).returning();
  return row;
}

async function seedProposal(overrides: Partial<typeof schema.proposalsTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.proposalsTable).values({
    title: "Propuesta de prueba",
    status: "sent",
    amount: "45000",
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

describe("approveProposalByToken — camino real de /public/proposals/:token/approve", () => {
  test("primera aprobación: genera cuotas y CADA UNA tiene publicToken real (no null) — el bug exacto que arregló payment-schedule/repository.ts", async () => {
    const client = await seedClient("Cliente de prueba");
    const proposal = await seedProposal({ clientId: client.id, amount: "45000" });

    const result = await approveProposalByToken(proposal.publicToken, testDb as unknown as Parameters<typeof approveProposalByToken>[1]);
    assert.equal(result.status, 200);

    const invoices = await testDb.select().from(schema.invoicesTable).where(eq(schema.invoicesTable.proposalId, proposal.id));
    assert.equal(invoices.length, 2, "plan standard: anticipo + pago final");
    for (const invoice of invoices) {
      assert.equal(typeof invoice.publicToken, "string", `factura ${invoice.installmentLabel} debe tener publicToken real`);
      assert.ok(invoice.publicToken && invoice.publicToken.length > 0);
    }

    // No solo el estado de la BD — el JSON que realmente ve el cliente en
    // /propuesta/:token también debe traer un publicToken real, no null,
    // en nextInvoice (serializePublicView.nextInvoice.publicToken).
    const body = result.body as { nextInvoice: { publicToken: string } | null };
    assert.ok(body.nextInvoice, "la respuesta debe incluir la cuota activa");
    assert.equal(typeof body.nextInvoice?.publicToken, "string");
    assert.ok(body.nextInvoice?.publicToken.length > 0, "nextInvoice.publicToken no debe llegar null al cliente — esto es lo que rompía el pago real");
  });

  test("segunda aprobación (idempotente): no duplica facturas y sigue devolviendo un publicToken real", async () => {
    const client = await seedClient("Cliente idempotente");
    const proposal = await seedProposal({ clientId: client.id, amount: "20000", paymentPlan: "large" });

    const first = await approveProposalByToken(proposal.publicToken, testDb as unknown as Parameters<typeof approveProposalByToken>[1]);
    assert.equal(first.status, 200);

    const second = await approveProposalByToken(proposal.publicToken, testDb as unknown as Parameters<typeof approveProposalByToken>[1]);
    assert.equal(second.status, 200);

    const invoices = await testDb.select().from(schema.invoicesTable).where(eq(schema.invoicesTable.proposalId, proposal.id));
    assert.equal(invoices.length, 3, "plan large: anticipo + hito + final — la segunda llamada no debe generar más");

    const body = second.body as { nextInvoice: { publicToken: string } | null };
    assert.equal(typeof body.nextInvoice?.publicToken, "string");
  });

  test("propuesta ya aprobada pero vencida (validUntil en el pasado): nextInvoice se oculta, expired:true — el bug real: antes esto seguía devolviendo la cuota pagable sin importar la fecha", async () => {
    const client = await seedClient("Cliente vencido");
    const proposal = await seedProposal({
      clientId: client.id,
      amount: "10000",
      status: "accepted",
      validUntil: new Date("2020-01-01"),
    });
    await testDb.insert(schema.invoicesTable).values({
      number: `TEST-${Date.now()}-${Math.random()}`,
      proposalId: proposal.id,
      clientId: client.id,
      amount: "10000",
      currency: "MXN",
      status: "sent",
      publicToken: "11111111-1111-1111-1111-111111111111",
    });

    const result = await approveProposalByToken(proposal.publicToken, testDb as unknown as Parameters<typeof approveProposalByToken>[1]);
    assert.equal(result.status, 200);

    const body = result.body as { expired: boolean; nextInvoice: unknown };
    assert.equal(body.expired, true);
    assert.equal(body.nextInvoice, null, "una propuesta vencida no debe seguir ofreciendo una cuota pagable");
  });

  test("propuesta aprobada con validUntil en el futuro: sigue mostrando nextInvoice normalmente — el fix de vencimiento no rompe el caso vigente", async () => {
    const client = await seedClient("Cliente vigente");
    const proposal = await seedProposal({
      clientId: client.id,
      amount: "10000",
      status: "accepted",
      validUntil: new Date("2099-01-01"),
    });
    await testDb.insert(schema.invoicesTable).values({
      number: `TEST-${Date.now()}-${Math.random()}`,
      proposalId: proposal.id,
      clientId: client.id,
      amount: "10000",
      currency: "MXN",
      status: "sent",
      publicToken: "22222222-2222-2222-2222-222222222222",
    });

    const result = await approveProposalByToken(proposal.publicToken, testDb as unknown as Parameters<typeof approveProposalByToken>[1]);
    const body = result.body as { expired: boolean; nextInvoice: { publicToken: string } | null };
    assert.equal(body.expired, false);
    assert.ok(body.nextInvoice, "una propuesta vigente debe seguir mostrando su cuota pagable");
  });
});
