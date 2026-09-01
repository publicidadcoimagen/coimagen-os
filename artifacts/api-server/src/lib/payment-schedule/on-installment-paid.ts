import { and, eq } from "drizzle-orm";
import { db, invoicesTable, proposalsTable, subscriptionsTable, clientsTable } from "@workspace/db";
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

  // Business decision (Camila, confirmed against Contrato Maestro V2
  // cláusula 4 — "no se inicia ningún trabajo en producción sin el
  // anticipo correspondiente ya cubierto"): "pago confirmado" means the
  // ANTICIPO specifically (cuota 1, always 50% — see PLAN_INSTALLMENTS in
  // generate.ts), not the full payment plan. Applies uniformly to Founders
  // and regular clients — nothing here special-cases either.
  //
  // Identified by invoice NUMBER, not status or position in the list:
  // createInstallmentInvoices names the first cuota `P{proposalId}-1`
  // (i === 0) at creation time, and that never changes — unlike `status`,
  // which every cuota passes through "sent" on its own turn (see
  // advanceNextInstallment), so a later cuota being "sent" then paid can't
  // be mistaken for the anticipo.
  //
  // Guarded by clients.status = "pending_payment" so this is a no-op (not
  // an error) on a duplicate/late webhook delivery, or if staff already
  // manually changed the client's status for some other reason — it only
  // ever moves pending_payment -> active, never overwrites any other
  // status. Does NOT gate Client Room access either way (see the comment
  // on convertProspectToClient's client insert) — this only affects
  // dashboard/reporting.
  if (invoice.clientId && invoice.number === `P${invoice.proposalId}-1`) {
    await db.update(clientsTable).set({ status: "active", updatedAt: new Date() })
      .where(and(eq(clientsTable.id, invoice.clientId), eq(clientsTable.status, "pending_payment")));
  }

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
