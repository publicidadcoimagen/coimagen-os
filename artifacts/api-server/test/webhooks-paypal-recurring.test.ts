import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, subscriptionsTable, invoicesTable, invoicePaymentsTable, clientsTable } from "@workspace/db";
import { handleRecurringPaymentFailed, handleRecurringPaymentCompleted } from "../src/routes/webhooks-paypal";

// Fakes db.select/update/insert by inspecting which table was passed,
// rather than by call order (unlike impersonation.test.ts's two-call
// sequence) — handleRecurringPaymentCompleted branches on requiresFiscalInvoice
// and issues a variable number of selects/inserts, so table identity is the
// only stable thing to key the fake responses on.
function mockDb(t: import("node:test").TestContext, opts: {
  subscription: Record<string, unknown> | null;
  existingInvoicePayment?: Record<string, unknown> | null;
}) {
  const updateCalls: { table: unknown; values: Record<string, unknown> }[] = [];
  const insertCalls: { table: unknown; values: Record<string, unknown> }[] = [];

  t.mock.method(db, "select", (() => ({
    from: (table: unknown) => ({
      where: async () => {
        if (table === subscriptionsTable) return opts.subscription ? [opts.subscription] : [];
        if (table === invoicePaymentsTable) return opts.existingInvoicePayment ? [opts.existingInvoicePayment] : [];
        if (table === clientsTable) return [{ name: "Cliente de Prueba" }];
        return [];
      },
    }),
  })) as unknown as typeof db.select);

  t.mock.method(db, "update", ((table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => { updateCalls.push({ table, values }); },
    }),
  })) as unknown as typeof db.update);

  t.mock.method(db, "insert", ((table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      insertCalls.push({ table, values });
      const result = Promise.resolve(undefined);
      (result as unknown as { returning: () => Promise<Record<string, unknown>[]> }).returning =
        async () => [{ id: 999, ...values }];
      return result;
    },
  })) as unknown as typeof db.insert);

  return { updateCalls, insertCalls };
}

const BASE_SUBSCRIPTION = {
  id: 42,
  clientId: 7,
  plan: "pro",
  amount: "1000",
  requiresFiscalInvoice: false,
  paypalSubscriptionId: "SUB-123",
};

describe("handleRecurringPaymentFailed", () => {
  test("marks an active subscription past_due", async (t) => {
    const { updateCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "active" } });

    await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "SUB-123" } });

    const subUpdate = updateCalls.find((c) => c.table === subscriptionsTable);
    assert.ok(subUpdate, "subscriptions.status must be updated");
    assert.equal(subUpdate!.values.status, "past_due");
  });

  test("never overwrites a cancelled subscription", async (t) => {
    const { updateCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "cancelled" } });

    await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "SUB-123" } });

    const subUpdate = updateCalls.find((c) => c.table === subscriptionsTable);
    assert.equal(subUpdate, undefined, "a cancelled subscription must stay cancelled");
  });

  test("no matching subscription — no-op, no crash", async (t) => {
    const { updateCalls } = mockDb(t, { subscription: null });
    await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "does-not-exist" } });
    assert.equal(updateCalls.length, 0);
  });
});

describe("handleRecurringPaymentCompleted", () => {
  test("clears past_due back to active on a successful recurring charge", async (t) => {
    const { updateCalls, insertCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "past_due" } });

    await handleRecurringPaymentCompleted({
      resource: { id: "SALE-1", billing_agreement_id: "SUB-123", amount: { total: "1000", currency: "MXN" } },
    });

    const subUpdate = updateCalls.find((c) => c.table === subscriptionsTable);
    assert.ok(subUpdate, "a past_due subscription must be reactivated by a successful charge");
    assert.equal(subUpdate!.values.status, "active");
    assert.ok(insertCalls.some((c) => c.table === invoicesTable), "the recurring charge must still be recorded as an invoice");
  });

  test("leaves an already-active subscription untouched (no redundant update)", async (t) => {
    const { updateCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "active" } });

    await handleRecurringPaymentCompleted({
      resource: { id: "SALE-2", billing_agreement_id: "SUB-123", amount: { total: "1000", currency: "MXN" } },
    });

    const subUpdate = updateCalls.find((c) => c.table === subscriptionsTable);
    assert.equal(subUpdate, undefined);
  });

  test("a duplicate webhook delivery (already-recorded sale) is a no-op", async (t) => {
    const { updateCalls, insertCalls } = mockDb(t, {
      subscription: { ...BASE_SUBSCRIPTION, status: "past_due" },
      existingInvoicePayment: { id: 1 },
    });

    await handleRecurringPaymentCompleted({
      resource: { id: "SALE-3", billing_agreement_id: "SUB-123", amount: { total: "1000", currency: "MXN" } },
    });

    assert.equal(insertCalls.length, 0, "an already-recorded sale must not be recorded twice");
    assert.equal(updateCalls.length, 0, "a duplicate delivery must not touch subscription status either");
  });
});
