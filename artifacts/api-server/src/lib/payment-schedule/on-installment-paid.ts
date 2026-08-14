import { eq } from "drizzle-orm";
import { db, invoicesTable, proposalsTable, subscriptionsTable } from "@workspace/db";
import { markInvoicePaid, advanceNextInstallment, allInstallmentsPaid } from "./repository";
import { createSubscription } from "../paypal/subscriptions";
import { logger } from "../logger";

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
  // recurring component; nothing to create.
  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, invoice.proposalId));
  if (!proposal?.monthlyAmount || !proposal.clientId) return;

  const [subscriptionRow] = await db.insert(subscriptionsTable).values({
    clientId: proposal.clientId,
    proposalId: proposal.id,
    plan: proposal.title,
    amount: proposal.monthlyAmount,
    billingCycle: "monthly",
    status: "pending_authorization",
  }).returning();

  try {
    const { paypalSubscriptionId, approveUrl } = await createSubscription(
      parseFloat(proposal.monthlyAmount),
      proposal.currency,
      String(subscriptionRow.id),
    );
    await db.update(subscriptionsTable).set({ paypalSubscriptionId, paypalApproveUrl: approveUrl, updatedAt: new Date() }).where(eq(subscriptionsTable.id, subscriptionRow.id));
  } catch (err) {
    // The subscription row stays in pending_authorization with no
    // paypalSubscriptionId — lib/subscription-alerts' 3-day staff alert
    // catches this exactly like it catches "client never clicked approve",
    // so no separate error-handling path is needed here beyond logging.
    logger.error({ err, subscriptionId: subscriptionRow.id }, "No se pudo crear la suscripción en PayPal");
  }
}
