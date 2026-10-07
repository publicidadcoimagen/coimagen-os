// Pro-bono / $0 flows. Pure guards + real-Postgres (PGlite, embedded —
// never Neon) runs of the exact production code that settles a payment
// schedule and authorizes subscriptions. PayPal is an injected spy: the
// zero cases must never call it.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { generateInstallments, isZeroAmount, recurringPlanFor } from "../src/lib/payment-schedule/generate";
import { createInstallmentInvoices } from "../src/lib/payment-schedule/repository";
import { settleScheduleAfterPayment } from "../src/lib/payment-schedule/on-installment-paid";
import { finalizeSubscriptionAuthorization } from "../src/lib/subscription-authorization";

describe("zero-amount guards (pure)", () => {
  test("isZeroAmount compares numerically — '0' and '0.00' are zero, not truthy strings", () => {
    assert.equal(isZeroAmount("0"), true);
    assert.equal(isZeroAmount("0.00"), true);
    assert.equal(isZeroAmount(0), true);
    assert.equal(isZeroAmount("1500"), false);
    assert.equal(isZeroAmount(null), false);
    assert.equal(isZeroAmount(""), false);
  });

  test("recurringPlanFor: monthly '0' and '0.00' → internal_zero, positive → paypal, null → none", () => {
    assert.equal(recurringPlanFor("0"), "internal_zero");
    assert.equal(recurringPlanFor("0.00"), "internal_zero");
    assert.equal(recurringPlanFor("1500"), "paypal");
    assert.equal(recurringPlanFor(null), "none");
    assert.throws(() => recurringPlanFor("-5"));
  });

  test("setup 0 → every cuota is exactly 0 for both plans; negative/NaN totals throw", () => {
    assert.deepEqual(generateInstallments(0, "standard").map((i) => i.amount), [0, 0]);
    assert.deepEqual(generateInstallments(0, "large").map((i) => i.amount), [0, 0, 0]);
    assert.throws(() => generateInstallments(-1, "standard"));
    assert.throws(() => generateInstallments(Number.NaN, "standard"));
  });
});

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;
type Db = Parameters<typeof settleScheduleAfterPayment>[1];

before(async () => {
  pglite = new PGlite();
  await pglite.exec(generateSchemaSql(["clientsTable", "prospectsTable", "proposalsTable", "invoicesTable", "subscriptionsTable"]));
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());
beforeEach(async () => {
  await testDb.delete(schema.subscriptionsTable);
  await testDb.delete(schema.invoicesTable);
  await testDb.delete(schema.proposalsTable);
  await testDb.delete(schema.clientsTable);
});

// Converted proposal + its generated cuotas, then the deposit marked paid by
// hand (what staff does for a pro-bono client) and the schedule settled.
async function payDeposit(amount: string, monthlyAmount: string | null, paymentPlan = "standard") {
  const [client] = await testDb.insert(schema.clientsTable).values({ name: "Tienda pro-bono", accessGateExempt: true }).returning();
  const [proposal] = await testDb.insert(schema.proposalsTable).values({
    title: "Ecommerce pro-bono", clientId: client.id, status: "accepted", amount, monthlyAmount, paymentPlan, currency: "MXN",
  }).returning();
  const invoices = await createInstallmentInvoices(proposal, testDb as unknown as Parameters<typeof createInstallmentInvoices>[1]);
  await testDb.update(schema.invoicesTable).set({ status: "paid" }).where(eq(schema.invoicesTable.id, invoices[0].id));
  const outcome = await settleScheduleAfterPayment(proposal.id, testDb as unknown as Db);
  const rows = await testDb.select().from(schema.invoicesTable).where(eq(schema.invoicesTable.proposalId, proposal.id));
  const subs = await testDb.select().from(schema.subscriptionsTable).where(eq(schema.subscriptionsTable.proposalId, proposal.id));
  return { outcome, invoices: rows, subs };
}

describe("settleScheduleAfterPayment — real Postgres", () => {
  test("setup 0 + monthly '0' (50/50): remaining $0 cuota auto-settled, internal ACTIVE $0 subscription, nothing pending", async () => {
    const { outcome, invoices, subs } = await payDeposit("0", "0");
    assert.equal(outcome, "internal_zero");
    assert.deepEqual(invoices.map((i) => [i.amount, i.status]), [["0", "paid"], ["0", "paid"]], "visible $0 records, both paid");
    assert.equal(subs.length, 1);
    assert.equal(subs[0].status, "active", "never pending_authorization for a $0 fee");
    assert.equal(Number(subs[0].amount), 0);
    assert.equal(subs[0].paypalSubscriptionId, null);
  });

  test("setup 0 + monthly '0.00' (50/25/25): same outcome", async () => {
    const { outcome, invoices, subs } = await payDeposit("0", "0.00", "large");
    assert.equal(outcome, "internal_zero");
    assert.equal(invoices.length, 3);
    assert.ok(invoices.every((i) => i.status === "paid"));
    assert.equal(subs[0].status, "active");
  });

  test("setup 0 + positive monthly: PayPal path (pending_authorization), unchanged", async () => {
    const { outcome, subs } = await payDeposit("0", "1500");
    assert.equal(outcome, "paypal");
    assert.equal(subs[0].status, "pending_authorization");
  });

  test("real setup + monthly 0: next cuota is SENT for payment, no subscription yet", async () => {
    const { outcome, invoices, subs } = await payDeposit("1000", "0");
    assert.equal(outcome, "pending_installments");
    assert.deepEqual(invoices.map((i) => i.status), ["paid", "sent"]);
    assert.equal(subs.length, 0);
  });

  test("no monthly fee (one-off project): no subscription at all", async () => {
    const { outcome, subs } = await payDeposit("0", null);
    assert.equal(outcome, "none");
    assert.equal(subs.length, 0);
  });
});

describe("finalizeSubscriptionAuthorization never calls PayPal for $0", () => {
  async function pendingSub(amount: string) {
    const [client] = await testDb.insert(schema.clientsTable).values({ name: "c" }).returning();
    const [sub] = await testDb.insert(schema.subscriptionsTable).values({ clientId: client.id, plan: "p", amount, currency: "MXN", status: "pending_authorization" }).returning();
    return sub;
  }
  const deps = (calls: number[]) => ({
    db: testDb as unknown as Parameters<typeof finalizeSubscriptionAuthorization>[2] extends infer D ? D extends { db: infer X } ? X : never : never,
    createSubscription: async (amount: number) => { calls.push(amount); return { paypalSubscriptionId: "I-FAKE", approveUrl: "https://example/approve" }; },
  });

  test("legacy $0 pending row → activated internally, PayPal spy NOT called", async () => {
    const sub = await pendingSub("0");
    const calls: number[] = [];
    await finalizeSubscriptionAuthorization(sub.id, { requiresFiscalInvoice: false }, deps(calls));
    assert.deepEqual(calls, [], "createSubscription must not be called for a $0 fee");
    const [row] = await testDb.select().from(schema.subscriptionsTable).where(eq(schema.subscriptionsTable.id, sub.id));
    assert.equal(row.status, "active");
    assert.equal(row.paypalSubscriptionId, null);
  });

  test("sanity: a positive fee still goes to PayPal exactly once", async () => {
    const sub = await pendingSub("1500");
    const calls: number[] = [];
    await finalizeSubscriptionAuthorization(sub.id, { requiresFiscalInvoice: false }, deps(calls));
    assert.deepEqual(calls, [1500]);
  });
});
