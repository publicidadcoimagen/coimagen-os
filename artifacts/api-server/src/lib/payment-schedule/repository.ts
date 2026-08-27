import { eq, and, asc, inArray } from "drizzle-orm";
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
export async function findActivePaymentAttempt(invoiceId: number, now = new Date()) {
  const rows = await db.select().from(invoicePaymentsTable)
    .where(and(eq(invoicePaymentsTable.invoiceId, invoiceId), inArray(invoicePaymentsTable.status, ACTIVE_PAYMENT_STATUSES)));
  return rows.find((row) => isPaymentAttemptStillActive(row.createdAt, now)) ?? null;
}
