import { eq } from "drizzle-orm";
import { db, invoicesTable, proposalsTable, subscriptionsTable, clientsTable } from "@workspace/db";
import { markInvoicePaid, advanceNextInstallment, allInstallmentsPaid } from "./repository";
import { sendPaymentConfirmedEmail } from "./payment-confirmed-email";
import { createClientPortalAccount } from "../portal-onboarding/create-client-account";
import { sendPortalCredentialsEmail } from "../portal-onboarding/credentials-email";
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

  // Best-effort, same pattern as the fiscal-invoice alert in
  // webhooks-paypal.ts — a Resend outage must never fail the payment
  // itself. reactivatedAccess is always false here: this is a new
  // proposal's deposit/milestone cuota, and a client can't have been
  // access-gate-restricted before their subscription even exists (that
  // only happens below, once ALL installments are paid). The recurring
  // mensualidad's own "you were past_due, now reactivated" case is handled
  // separately in webhooks-paypal.ts's handleRecurringPaymentCompleted.
  if (invoice.clientId) {
    const [client] = await db.select({ name: clientsTable.name, email: clientsTable.email }).from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
    if (client?.email) {
      // Portal account + credentials, only the first time this client ever
      // pays anything — createClientPortalAccount itself checks for an
      // existing role="cliente" row for this clientId and returns null if
      // one already exists, so a later cuota/mensualidad never re-creates
      // or re-sends credentials.
      try {
        const created = await createClientPortalAccount(invoice.clientId, client.name, client.email);
        if (created) {
          const emailId = await sendPortalCredentialsEmail(client.email, client.name, created.temporaryPassword);
          logger.info({ invoiceId, clientId: invoice.clientId, emailId }, "Cuenta de portal creada y credenciales enviadas");
        }
      } catch (err) {
        logger.warn({ err, invoiceId, clientId: invoice.clientId }, "No se pudo crear la cuenta de portal / enviar credenciales");
      }

      try {
        const emailId = await sendPaymentConfirmedEmail(client.email, client.name, invoice.number, invoice.amount, invoice.currency, false);
        logger.info({ invoiceId, emailId }, "Correo de pago confirmado enviado al cliente");
      } catch (err) {
        logger.warn({ err, invoiceId }, "No se pudo enviar el correo de pago confirmado");
      }
    }
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
    currency: proposal.currency,
    billingCycle: "monthly",
    status: "pending_authorization",
  });
}
