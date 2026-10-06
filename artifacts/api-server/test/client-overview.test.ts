import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildClientOverview, isOverdue } from "../src/lib/client-overview/build";

const TODAY = "2026-10-06";
const d = (iso: string) => new Date(iso);

describe("client overview — CEO client list health", () => {
  test("overdue = explicitly overdue, or sent and past due; drafts never count", () => {
    assert.equal(isOverdue({ clientId: 1, status: "overdue", dueDate: null }, TODAY), true);
    assert.equal(isOverdue({ clientId: 1, status: "sent", dueDate: "2026-10-01" }, TODAY), true);
    assert.equal(isOverdue({ clientId: 1, status: "sent", dueDate: "2026-10-10" }, TODAY), false);
    assert.equal(isOverdue({ clientId: 1, status: "draft", dueDate: "2026-10-01" }, TODAY), false, "an unsent draft is not owed yet");
  });

  test("counts overdue and pending invoices per client", () => {
    const [row] = buildClientOverview({
      clients: [{ id: 1, enabledModules: [], accessGateExempt: false }],
      invoices: [
        { clientId: 1, status: "sent", dueDate: "2026-10-01" },
        { clientId: 1, status: "sent", dueDate: "2026-10-20" },
        { clientId: 1, status: "paid", dueDate: "2026-09-01" },
        { clientId: 2, status: "sent", dueDate: "2026-10-01" },
      ],
      subscriptions: [], contracts: [], portalClientIds: new Set(), today: TODAY,
    });
    assert.equal(row.overdueInvoices, 1);
    assert.equal(row.pendingInvoices, 1);
  });

  test("latest subscription and latest NON-test contract win", () => {
    const [row] = buildClientOverview({
      clients: [{ id: 1, enabledModules: ["ecommerce"], accessGateExempt: false }],
      invoices: [],
      subscriptions: [
        { clientId: 1, status: "cancelled", createdAt: d("2026-08-01") },
        { clientId: 1, status: "active", createdAt: d("2026-09-01") },
      ],
      contracts: [
        { clientId: 1, status: "sent", isTest: false, createdAt: d("2026-09-01") },
        { clientId: 1, status: "signed", isTest: true, createdAt: d("2026-09-20") },
      ],
      portalClientIds: new Set([1]), today: TODAY,
    });
    assert.equal(row.subscriptionStatus, "active");
    assert.equal(row.contractStatus, "sent", "a test contract must not make a client look signed");
    assert.equal(row.hasPortalAccount, true);
    assert.deepEqual(row.enabledModules, ["ecommerce"]);
  });

  test("a client with nothing yet gets nulls and zeros, and pro bono is flagged", () => {
    const [row] = buildClientOverview({
      clients: [{ id: 6, enabledModules: [], accessGateExempt: true }],
      invoices: [], subscriptions: [], contracts: [], portalClientIds: new Set(), today: TODAY,
    });
    assert.deepEqual(row, {
      clientId: 6, overdueInvoices: 0, pendingInvoices: 0, subscriptionStatus: null,
      contractStatus: null, hasPortalAccount: false, enabledModules: [], proBono: true,
    });
  });
});
