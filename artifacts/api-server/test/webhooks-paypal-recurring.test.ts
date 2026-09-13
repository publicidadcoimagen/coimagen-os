import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, subscriptionsTable, invoicesTable, invoicePaymentsTable, clientsTable, subscriptionAlertsTable } from "@workspace/db";
import { handleRecurringPaymentFailed, handleRecurringPaymentCompleted } from "../src/routes/webhooks-paypal";

// Fakes db.select/update/insert/delete by inspecting which table was
// passed, rather than by call order (unlike impersonation.test.ts's
// two-call sequence) — handleRecurringPaymentCompleted branches on
// requiresFiscalInvoice and issues a variable number of selects/inserts,
// so table identity is the only stable thing to key the fake responses on.
function mockDb(t: import("node:test").TestContext, opts: {
  subscription: Record<string, unknown> | null;
  existingInvoicePayment?: Record<string, unknown> | null;
  clientEmail?: string | null;
  existingPaymentFailedAlert?: boolean;
}) {
  const updateCalls: { table: unknown; values: Record<string, unknown> }[] = [];
  const insertCalls: { table: unknown; values: Record<string, unknown> }[] = [];
  const deleteCalls: { table: unknown }[] = [];

  t.mock.method(db, "select", (() => ({
    from: (table: unknown) => ({
      where: async () => {
        if (table === subscriptionsTable) return opts.subscription ? [opts.subscription] : [];
        if (table === invoicePaymentsTable) return opts.existingInvoicePayment ? [opts.existingInvoicePayment] : [];
        if (table === clientsTable) return [{ name: "Cliente de Prueba", email: opts.clientEmail === undefined ? "cliente@example.com" : opts.clientEmail }];
        if (table === subscriptionAlertsTable) return opts.existingPaymentFailedAlert ? [{ id: 1 }] : [];
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

  t.mock.method(db, "delete", ((table: unknown) => ({
    where: async () => { deleteCalls.push({ table }); },
  })) as unknown as typeof db.delete);

  return { updateCalls, insertCalls, deleteCalls };
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

  describe("Día 0 (Cláusula 9) — overdue invoice + client notice", () => {
    test("a genuinely new failure creates an overdue invoice and records the Día 0 alert", async (t) => {
      const { insertCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "active" }, existingPaymentFailedAlert: false });

      await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "SUB-123" } });

      const invoiceInsert = insertCalls.find((c) => c.table === invoicesTable);
      assert.ok(invoiceInsert, "must create an overdue invoice");
      assert.equal(invoiceInsert!.values.status, "overdue");
      assert.equal(invoiceInsert!.values.amount, "1000");
      assert.equal(invoiceInsert!.values.clientId, 7);

      const alertInsert = insertCalls.find((c) => c.table === subscriptionAlertsTable);
      assert.ok(alertInsert, "must record the Día 0 dedup alert");
      assert.equal(alertInsert!.values.subscriptionId, 42);
      assert.equal(alertInsert!.values.stage, "recurring_payment_failed");
    });

    test("a redelivered webhook for an already-alerted subscription does NOT create a second overdue invoice", async (t) => {
      const { insertCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "past_due" }, existingPaymentFailedAlert: true });

      await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "SUB-123" } });

      assert.equal(insertCalls.find((c) => c.table === invoicesTable), undefined, "no duplicate overdue invoice for a redelivered webhook");
      assert.equal(insertCalls.find((c) => c.table === subscriptionAlertsTable), undefined, "no duplicate alert record either");
    });

    test("a client with no email skips the email attempt but still creates the invoice", async (t) => {
      const { insertCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "active" }, clientEmail: null, existingPaymentFailedAlert: false });

      await handleRecurringPaymentFailed({ resource: { billing_agreement_id: "SUB-123" } });

      assert.ok(insertCalls.find((c) => c.table === invoicesTable), "invoice still created even with no client email to notify");
    });
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

  test("reactivating past_due clears BOTH the Día 0 and Día 3 dedup records, so the NEXT failure episode notifies/surcharges again", async (t) => {
    const { deleteCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "past_due" } });

    await handleRecurringPaymentCompleted({
      resource: { id: "SALE-1b", billing_agreement_id: "SUB-123", amount: { total: "1000", currency: "MXN" } },
    });

    const alertDeletes = deleteCalls.filter((c) => c.table === subscriptionAlertsTable);
    assert.equal(alertDeletes.length, 2, "must clear both the Día 0 alert record and the Día 3 surcharge alert record on reactivation");
  });

  test("leaves an already-active subscription untouched (no redundant update, no dedup clear)", async (t) => {
    const { updateCalls, deleteCalls } = mockDb(t, { subscription: { ...BASE_SUBSCRIPTION, status: "active" } });

    await handleRecurringPaymentCompleted({
      resource: { id: "SALE-2", billing_agreement_id: "SUB-123", amount: { total: "1000", currency: "MXN" } },
    });

    assert.equal(updateCalls.find((c) => c.table === subscriptionsTable), undefined);
    assert.equal(deleteCalls.length, 0, "nothing to clear — it was never past_due");
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
