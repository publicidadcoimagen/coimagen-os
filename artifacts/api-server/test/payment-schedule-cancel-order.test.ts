// Real-Postgres (PGlite) tests for the PayPal-cancel double-payment-guard
// fix: cancelling the popup (SDK onCancel, see PaymentBox.tsx) now marks
// the matching invoice_payments row "failed" instead of leaving it
// "created" for up to the guard window (see eligibility.ts's ORDER_EXPIRY_MS) — that
// stale row was what made a second payment attempt (PayPal or card) fail
// with "Ya hay un pago en proceso para esta cuota" even though the client
// explicitly backed out of the first one.
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
import { findActivePaymentAttempt, markPaymentAttemptCancelled } from "../src/lib/payment-schedule/repository";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedClient(name: string) {
  const [row] = await testDb.insert(schema.clientsTable).values({ name }).returning();
  return row;
}

async function seedInvoice(clientId: number, overrides: Partial<typeof schema.invoicesTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.invoicesTable).values({
    number: `TEST-${Date.now()}-${Math.random()}`,
    clientId,
    amount: "990",
    status: "sent",
    ...overrides,
  }).returning();
  return row;
}

async function seedPayment(invoiceId: number, overrides: Partial<typeof schema.invoicePaymentsTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.invoicePaymentsTable).values({
    invoiceId,
    paypalOrderId: `ORDER-${Date.now()}-${Math.random()}`,
    status: "created",
    amount: "990",
    currency: "MXN",
    ...overrides,
  }).returning();
  return row;
}

before(async () => {
  pglite = new PGlite();
  // PGlite otherwise inherits the host machine's local timezone for
  // now()/defaultNow(), while reading a "timestamp without time zone"
  // column back always assumes UTC — on a non-UTC sandbox that skews every
  // DB-generated createdAt by the local offset relative to a freshly
  // constructed JS Date, which silently breaks any test (like this one)
  // that compares the two. Real Postgres in production (Render) runs UTC,
  // so this just makes the test environment match production instead of
  // masking the skew by avoiding defaultNow().
  await pglite.exec("SET TIME ZONE 'UTC'");
  const sql = generateSchemaSql(["clientsTable", "prospectsTable", "proposalsTable", "invoicesTable", "invoicePaymentsTable"]);
  await pglite.exec(sql);
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());

describe("markPaymentAttemptCancelled — libera el guard de doble pago al cancelar el popup", () => {
  test("cancelar el popup marca la fila como failed, y el guard deja de bloquear un segundo intento de inmediato", async () => {
    const client = await seedClient("Cliente ecomerce");
    const invoice = await seedInvoice(client.id);
    const payment = await seedPayment(invoice.id);

    // Antes de cancelar: el guard SÍ bloquea (fila "created", recién creada).
    const before = await findActivePaymentAttempt(invoice.id, new Date(), testDb as unknown as Parameters<typeof findActivePaymentAttempt>[2]);
    assert.ok(before, "un intento recién creado debe bloquear un segundo intento");
    assert.equal(before?.status, "created");

    await markPaymentAttemptCancelled(invoice.id, payment.paypalOrderId, testDb as unknown as Parameters<typeof markPaymentAttemptCancelled>[2]);

    const [updated] = await testDb.select().from(schema.invoicePaymentsTable).where(eq(schema.invoicePaymentsTable.id, payment.id));
    assert.equal(updated.status, "failed", "la fila debe quedar failed, no seguir en created");

    // Después de cancelar: el guard YA NO bloquea — sin esperar las 3 horas
    // de eligibility.ts (ORDER_EXPIRY_MS). Se pasa `now` = justo después de
    // crear el intento, para probar explícitamente que la liberación es
    // inmediata y no depende de que pase tiempo.
    const after = await findActivePaymentAttempt(invoice.id, new Date(), testDb as unknown as Parameters<typeof findActivePaymentAttempt>[2]);
    assert.equal(after, null, "un segundo intento de pago (PayPal o tarjeta) ya no debe bloquearse tras cancelar");
  });

  test("idempotente: cancelar una orden que ya fue capturada no la sobrescribe a failed", async () => {
    const client = await seedClient("Cliente ya pagó");
    const invoice = await seedInvoice(client.id);
    const payment = await seedPayment(invoice.id, { status: "captured" });

    await markPaymentAttemptCancelled(invoice.id, payment.paypalOrderId, testDb as unknown as Parameters<typeof markPaymentAttemptCancelled>[2]);

    const [row] = await testDb.select().from(schema.invoicePaymentsTable).where(eq(schema.invoicePaymentsTable.id, payment.id));
    assert.equal(row.status, "captured", "una fila ya resuelta (captured) nunca debe volver a failed por una cancelación tardía");
  });

  test("no afecta el intento de OTRA factura, aunque comparta cliente", async () => {
    const client = await seedClient("Cliente con dos cuotas");
    const invoiceA = await seedInvoice(client.id);
    const invoiceB = await seedInvoice(client.id);
    const paymentA = await seedPayment(invoiceA.id);
    const paymentB = await seedPayment(invoiceB.id);

    await markPaymentAttemptCancelled(invoiceA.id, paymentA.paypalOrderId, testDb as unknown as Parameters<typeof markPaymentAttemptCancelled>[2]);

    const [rowB] = await testDb.select().from(schema.invoicePaymentsTable).where(eq(schema.invoicePaymentsTable.id, paymentB.id));
    assert.equal(rowB.status, "created", "cancelar la cuota A no debe tocar el intento activo de la cuota B");
  });
});
