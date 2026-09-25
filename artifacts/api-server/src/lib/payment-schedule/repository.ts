import { randomUUID } from "node:crypto";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { db, invoicesTable, invoicePaymentsTable, type Invoice, type Proposal } from "@workspace/db";
import { generateInstallments } from "./generate";
import { isPaymentAttemptStillActive } from "./eligibility";

// "created"/"approved" are the two invoice_payments states between order
// creation and capture — a real payment attempt in flight. "captured" is
// resolved (paid), "failed"/"refunded" are resolved (not paid, but not
// blocking either) — see eligibility.ts for why age matters too.
const ACTIVE_PAYMENT_STATUSES = ["created", "approved"] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Generates the invoice installments for a just-approved proposal —
// deposit only starts as "sent" (payable right away); milestone/final
// stay "draft" (not shown/payable) until the previous one is paid, see
// advanceNextInstallment. Invoice numbers are traceable back to the
// proposal: "P{proposalId}-{n}".
//
// Accepts an optional dbClient (same pattern as
// prospect-conversion/repository.ts's convertProspectToClient) so a caller
// that already holds an open transaction — like that function, generating
// cuotas for a just-converted client — can pass its `tx` and get real
// atomicity: if invoice creation fails, the whole conversion rolls back
// too, instead of leaving a client with no payment schedule.
export async function createInstallmentInvoices(
  proposal: Proposal,
  dbClient: Pick<typeof db, "insert"> = db,
): Promise<Invoice[]> {
  if (!proposal.amount) {
    throw new Error(`No se pueden generar cuotas: la propuesta ${proposal.id} no tiene amount`);
  }
  if (!proposal.clientId) {
    throw new Error(`No se pueden generar cuotas: la propuesta ${proposal.id} no tiene clientId`);
  }

  const plan = proposal.paymentPlan === "large" ? "large" : "standard";
  const installments = generateInstallments(parseFloat(proposal.amount), plan);
  const today = todayIso();

  const rows = await dbClient.insert(invoicesTable).values(
    installments.map((installment, i) => ({
      number: `P${proposal.id}-${i + 1}`,
      clientId: proposal.clientId,
      amount: installment.amount.toString(),
      status: i === 0 ? "sent" : "draft",
      issuedDate: i === 0 ? today : null,
      dueDate: i === 0 ? today : null,
      description: `${proposal.title} — ${installment.label}`,
      proposalId: proposal.id,
      installmentLabel: installment.label,
      currency: proposal.currency,
      // Column has no DB-level default (nullable only for pre-existing
      // staff-created invoices that predate this field) — every installment
      // generated here needs one, since PaymentBox on the public proposal
      // page (/propuesta/:token) requires it to create the PayPal order.
      // Was missing entirely until 2026-09-16, which silently broke the
      // real payment step for any proposal accepted through the public link.
      publicToken: randomUUID(),
    })),
  ).returning();

  return rows;
}

// Client's explicit "necesito factura fiscal" choice for THIS cuota, set
// right before the PayPal order is created — never automatic, never
// inferred from anything else.
export async function setRequiresFiscalInvoice(invoiceId: number, requiresFiscalInvoice: boolean): Promise<void> {
  await db.update(invoicesTable).set({ requiresFiscalInvoice, updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId));
}

export async function markInvoicePaid(invoiceId: number): Promise<void> {
  await db.update(invoicesTable).set({ status: "paid", updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId));
}

// The next "draft" cuota for this proposal (large-plan only — standard
// plans have nothing left to advance after the deposit's pair), flipped to
// "sent" so it becomes visible/payable on its own /factura/:token page.
export async function advanceNextInstallment(proposalId: number): Promise<Invoice | null> {
  const [next] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.proposalId, proposalId), eq(invoicesTable.status, "draft")))
    .orderBy(asc(invoicesTable.id))
    .limit(1);
  if (!next) return null;

  const today = todayIso();
  const [updated] = await db.update(invoicesTable)
    .set({ status: "sent", issuedDate: today, dueDate: today, updatedAt: new Date() })
    .where(eq(invoicesTable.id, next.id))
    .returning();
  return updated;
}

// True once every installment generated for this proposal is paid — the
// trigger for creating the recurring subscription.
export async function allInstallmentsPaid(proposalId: number): Promise<boolean> {
  const rows = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.proposalId, proposalId));
  return rows.length > 0 && rows.every((r) => r.status === "paid");
}

// Guards against a double payment: while a genuinely in-flight PayPal order
// exists for this invoice (created/approved, not yet captured, and not old
// enough to have expired on PayPal's own side — see eligibility.ts),
// create-paypal-order must refuse to create a second one. This is checked
// server-side, not just in the frontend, because the frontend's PayPal
// button re-appearing after a slow webhook is exactly the scenario this
// guards against — an easily-skippable frontend-only check wouldn't help.
export async function findActivePaymentAttempt(
  invoiceId: number,
  now = new Date(),
  dbClient: Pick<typeof db, "select"> = db,
) {
  const rows = await dbClient.select().from(invoicePaymentsTable)
    .where(and(eq(invoicePaymentsTable.invoiceId, invoiceId), inArray(invoicePaymentsTable.status, ACTIVE_PAYMENT_STATUSES)));
  return rows.find((row) => isPaymentAttemptStillActive(row.createdAt, now)) ?? null;
}

// Called when the client cancels the PayPal popup (SDK onCancel) instead of
// approving it — releases findActivePaymentAttempt's block immediately
// instead of making the client wait out the order-expiry window (see
// eligibility.ts) for a payment they explicitly said they don't want right
// now. Only touches the row while it's still in an ACTIVE_PAYMENT_STATUSES
// state, so this is safe to call idempotently (a cancel request arriving
// after the order was already captured — e.g. approved in another tab — is
// a silent no-op, not an error, and never overwrites a real "captured"
// result with "failed"). Scoped by invoiceId, not just paypalOrderId, so a
// client can only cancel an order that actually belongs to the invoice
// their own public token resolves to.
export async function markPaymentAttemptCancelled(
  invoiceId: number,
  paypalOrderId: string,
  dbClient: Pick<typeof db, "update"> = db,
): Promise<void> {
  await dbClient.update(invoicePaymentsTable)
    .set({ status: "failed" })
    .where(and(
      eq(invoicePaymentsTable.invoiceId, invoiceId),
      eq(invoicePaymentsTable.paypalOrderId, paypalOrderId),
      inArray(invoicePaymentsTable.status, ACTIVE_PAYMENT_STATUSES),
    ));
}

// Full invoice_payments history for one invoice, newest first, each row
// annotated with the same active/blocking computation
// findActivePaymentAttempt uses server-side — so the staff evidence view
// (routes/invoices.ts's GET .../payments) can show "still blocking" without
// reimplementing or drifting from the real guard logic.
export async function listPaymentAttempts(invoiceId: number, now = new Date()) {
  const rows = await db.select().from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(desc(invoicePaymentsTable.createdAt));
  return rows.map((row) => ({
    ...row,
    ageSeconds: Math.floor((now.getTime() - row.createdAt.getTime()) / 1000),
    stillBlocking: ACTIVE_PAYMENT_STATUSES.includes(row.status as (typeof ACTIVE_PAYMENT_STATUSES)[number]) && isPaymentAttemptStillActive(row.createdAt, now),
  }));
}

// Staff-facing equivalent of markPaymentAttemptCancelled, keyed by the
// payment row's own id (what the evidence view shows) instead of requiring
// the paypalOrderId — lets staff release a stuck attempt directly from
// routes/invoices.ts's evidence panel without waiting for the guard window,
// same idempotency guarantee (only touches a still-created/approved row).
export async function releasePaymentAttempt(invoiceId: number, paymentId: number): Promise<void> {
  await db.update(invoicePaymentsTable)
    .set({ status: "failed" })
    .where(and(
      eq(invoicePaymentsTable.invoiceId, invoiceId),
      eq(invoicePaymentsTable.id, paymentId),
      inArray(invoicePaymentsTable.status, ACTIVE_PAYMENT_STATUSES),
    ));
}
