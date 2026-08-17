import { eq } from "drizzle-orm";
import { db, invoicesTable, proposalsTable, subscriptionsTable } from "@workspace/db";
import { markInvoicePaid, advanceNextInstallment, allInstallmentsPaid } from "./repository";

// The single authoritative place that reacts to a confirmed cuota payment
// — called ONLY from webhooks-paypal.ts's PAYMENT.CAPTURE.COMPLETED
// handler, never from the synchronous capture-order route (see that
// route's comment for why). Idempotency is the caller's job: the webhook
// handler must check invoice_payments.status before calling this, so it
// only ever runs once per invoice.
export async function handleInstallmentPaid(invoiceId: number): Promise<void> {
  await markInvoicePaid(invoiceId);

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice?.proposalId) return; // not a payment-schedule invoice (manual staff invoice) — nothing else to do

  const allPaid = await allInstallmentsPaid(invoice.proposalId);
  if (!allPaid) {
    await advanceNextInstallment(invoice.proposalId);
    return;
  }

  // Last installment just paid — start the recurring plan, if this
  // proposal has one. No monthlyAmount means a one-off project with no
  // recurring component; nothing to create. The row is left in
  // pending_authorization with NO PayPal subscription yet — the actual
  // PayPal subscription (and its fixed monthly price) is only created once
  // the client answers the fiscal-invoice question on /factura/:token (see
  // lib/subscription-authorization.ts), since that answer changes the
  // final price (base vs +16% IVA). Creating it here, before that answer
  // exists, would risk baking in the wrong price.
  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, invoice.proposalId));
  if (!proposal?.monthlyAmount || !proposal.clientId) return;

  await db.insert(subscriptionsTable).values({
    clientId: proposal.clientId,
    proposalId: proposal.id,
    plan: proposal.title,
    amount: proposal.monthlyAmount,
    billingCycle: "monthly",
    status: "pending_authorization",
  });
}
