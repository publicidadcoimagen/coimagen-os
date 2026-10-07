import { eq } from "drizzle-orm";
import { db, invoicesTable, proposalsTable, subscriptionsTable, clientsTable } from "@workspace/db";
import { markInvoicePaid, advanceNextInstallment, allInstallmentsPaid } from "./repository";
import { isZeroAmount, recurringPlanFor, type RecurringPlan } from "./generate";
import { sendPaymentConfirmedEmail } from "./payment-confirmed-email";
import { createClientPortalAccount } from "../portal-onboarding/create-client-account";
import { sendPortalCredentialsEmail } from "../portal-onboarding/credentials-email";
import { ensureClientRoom } from "../client-room/ensure-organization";
import { logger } from "../logger";

// True only when a staff edit actually moves an invoice INTO "paid" — the
// manual PATCH route uses this to run handleInstallmentPaid exactly once,
// same as the PayPal webhook, never again on a later edit of a paid invoice.
export function isTransitionToPaid(previousStatus: string | undefined, nextStatus: string | undefined): boolean {
  return nextStatus === "paid" && previousStatus !== undefined && previousStatus !== "paid";
}

// The single authoritative place that reacts to a confirmed cuota payment
// — called from webhooks-paypal.ts's PAYMENT.CAPTURE.COMPLETED handler and
// from staff's manual mark-as-paid (PATCH /invoices/:id), never from the
// synchronous capture-order route (see that route's comment for why). Idempotency is the caller's job: the webhook
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
      //
      // The Client Room organization is ensured FIRST: the credentials email
      // sends the client to the portal, which routes them by their
      // organization's slug — without one they'd log in to nothing. If it
      // can't be created, the account + email are skipped entirely (nothing
      // was created, so the next confirmed payment retries all of it).
      try {
        await ensureClientRoom(invoice.clientId);
        const created = await createClientPortalAccount(invoice.clientId, client.name, client.email);
        if (created) {
          const emailId = await sendPortalCredentialsEmail(client.email, client.name, created.temporaryPassword);
          logger.info({ invoiceId, clientId: invoice.clientId, emailId }, "Cuenta de portal creada y credenciales enviadas");
        }
      } catch (err) {
        logger.warn({ err, invoiceId, clientId: invoice.clientId }, "No se pudo crear la cuenta de portal / enviar credenciales");
      }

      // A $0 cuota (pro-bono) moved no money — no "payment confirmed" email.
      if (!isZeroAmount(invoice.amount)) {
        try {
          const emailId = await sendPaymentConfirmedEmail(client.email, client.name, invoice.number, invoice.amount, invoice.currency, false);
          logger.info({ invoiceId, emailId }, "Correo de pago confirmado enviado al cliente");
        } catch (err) {
          logger.warn({ err, invoiceId }, "No se pudo enviar el correo de pago confirmado");
        }
      }
    }
  }

  await settleScheduleAfterPayment(invoice.proposalId);
}

// After a cuota is paid: send the next one (settling any $0 cuotas on the
// way — advanceNextInstallment), and once every cuota is paid, start the
// recurring plan per recurringPlanFor:
// - "none": one-off project, nothing to create.
// - "internal_zero" (monthly exactly 0, pro-bono): an internal ACTIVE $0
//   subscription — the visible record in the client portal and the CEO
//   dashboard (adds 0 to MRR) — with no PayPal subscription and no fiscal
//   question. Nothing is left pending.
// - "paypal": pending_authorization with NO PayPal subscription yet — the
//   actual PayPal subscription (and its fixed monthly price) is only created
//   once the client answers the fiscal-invoice question on /factura/:token
//   (lib/subscription-authorization.ts), since that answer changes the
//   final price (base vs +16% IVA).
// The old guard `!proposal.monthlyAmount` treated "0" (a non-empty string)
// as a real fee and left pro-bono clients with a $0 pending_authorization
// subscription waiting on PayPal forever.
export async function settleScheduleAfterPayment(
  proposalId: number,
  dbClient: Pick<typeof db, "select" | "update" | "insert"> = db,
): Promise<"pending_installments" | RecurringPlan> {
  if (!(await allInstallmentsPaid(proposalId, dbClient))) {
    await advanceNextInstallment(proposalId, dbClient);
    if (!(await allInstallmentsPaid(proposalId, dbClient))) return "pending_installments";
  }

  const [proposal] = await dbClient.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId));
  if (!proposal?.clientId) return "none";
  const plan = recurringPlanFor(proposal.monthlyAmount);
  if (plan === "none") return plan;

  await dbClient.insert(subscriptionsTable).values({
    clientId: proposal.clientId,
    proposalId: proposal.id,
    plan: proposal.title,
    amount: proposal.monthlyAmount!,
    currency: proposal.currency,
    billingCycle: "monthly",
    status: plan === "internal_zero" ? "active" : "pending_authorization",
    requiresFiscalInvoice: false,
  });
  return plan;
}
