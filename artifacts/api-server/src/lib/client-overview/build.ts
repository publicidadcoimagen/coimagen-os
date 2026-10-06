// Pure aggregation behind GET /clients/overview — no DB, unit-testable.
// Gives the CEO one row per client with the things she otherwise has to open
// every client to find out: does it owe money, did it sign, can it log in to
// its portal, what modules does it have.

export type OverviewInvoice = { clientId: number | null; status: string; dueDate: string | null };
export type OverviewSubscription = { clientId: number | null; status: string; createdAt: Date };
export type OverviewContract = { clientId: number | null; status: string; isTest: boolean; createdAt: Date };
export type OverviewClient = { id: number; enabledModules: string[]; accessGateExempt: boolean };

export type ClientOverviewRow = {
  clientId: number;
  overdueInvoices: number;
  pendingInvoices: number;
  subscriptionStatus: string | null;
  contractStatus: string | null;
  hasPortalAccount: boolean;
  enabledModules: string[];
  proBono: boolean;
};

// Same definition of "overdue" as /dashboard/summary: explicitly overdue, or
// sent and past its due date. Drafts were never sent, so they never count.
export function isOverdue(inv: OverviewInvoice, today: string): boolean {
  return inv.status === "overdue" || (inv.status === "sent" && inv.dueDate !== null && inv.dueDate < today);
}

function latestBy<T extends { clientId: number | null; createdAt: Date }>(rows: T[]): Map<number, T> {
  const latest = new Map<number, T>();
  for (const row of rows) {
    if (row.clientId === null) continue;
    const current = latest.get(row.clientId);
    if (!current || row.createdAt > current.createdAt) latest.set(row.clientId, row);
  }
  return latest;
}

export function buildClientOverview(input: {
  clients: OverviewClient[];
  invoices: OverviewInvoice[];
  subscriptions: OverviewSubscription[];
  contracts: OverviewContract[];
  portalClientIds: Set<number>;
  today: string;
}): ClientOverviewRow[] {
  const overdue = new Map<number, number>();
  const pending = new Map<number, number>();
  for (const inv of input.invoices) {
    if (inv.clientId === null) continue;
    if (isOverdue(inv, input.today)) overdue.set(inv.clientId, (overdue.get(inv.clientId) ?? 0) + 1);
    else if (inv.status === "sent") pending.set(inv.clientId, (pending.get(inv.clientId) ?? 0) + 1);
  }
  const subscription = latestBy(input.subscriptions);
  // Test contracts (is_test, e.g. contract #4) are hidden from staff lists
  // by default — they must not make a client look "signed" either.
  const contract = latestBy(input.contracts.filter((c) => !c.isTest));

  return input.clients.map((c) => ({
    clientId: c.id,
    overdueInvoices: overdue.get(c.id) ?? 0,
    pendingInvoices: pending.get(c.id) ?? 0,
    subscriptionStatus: subscription.get(c.id)?.status ?? null,
    contractStatus: contract.get(c.id)?.status ?? null,
    hasPortalAccount: input.portalClientIds.has(c.id),
    enabledModules: c.enabledModules,
    // access_gate_exempt is set exactly on the pro-bono test accounts
    // (Coimagen Media, Dr. Segovia, Clínica EMT): never billed, never
    // restricted — so "no subscription" there is expected, not a problem.
    proBono: c.accessGateExempt,
  }));
}
