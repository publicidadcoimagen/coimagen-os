import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable, proposalsTable, type Subscription } from "@workspace/db";
import { createSubscription } from "./paypal/subscriptions";
import { submitClientFiscalData } from "./fiscal-data/repository";
import { applyFiscalInvoice } from "./payment-schedule/generate";

export async function findPendingSubscriptionForProposal(proposalId: number): Promise<Subscription | null> {
  const [row] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.proposalId, proposalId), eq(subscriptionsTable.status, "pending_authorization")))
    .limit(1);
  return row ?? null;
}

export interface FiscalChoice {
  requiresFiscalInvoice: boolean;
  rfc?: string;
  razonSocial?: string;
  constanciaBase64?: string;
  constanciaFileName?: string;
}

// The client's one-time fiscal choice for their recurring plan (CASO 2 of
// the P-payments fiscal-docs design) — finalizes the actual PayPal
// subscription only now, since the final monthly price (base vs +16% IVA)
// depends on this choice (see on-installment-paid.ts for why it isn't
// created any earlier). Blocking: if requiresFiscalInvoice is true,
// rfc/razonSocial/constancia are required — same rule as
// invoice_fiscal_data for one-time cuotas. Idempotent: a subscription that
// already has a paypalSubscriptionId is a no-op, so a retried/duplicate
// call from the client is harmless.
export async function finalizeSubscriptionAuthorization(subscriptionId: number, choice: FiscalChoice): Promise<void> {
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId));
  if (!subscription || subscription.paypalSubscriptionId) return;

  if (choice.requiresFiscalInvoice) {
    if (!choice.rfc || !choice.razonSocial || !choice.constanciaBase64 || !choice.constanciaFileName) {
      throw new Error("RFC, razón social y constancia son obligatorios para solicitar factura fiscal");
    }
    if (!subscription.clientId) {
      throw new Error(`La suscripción ${subscriptionId} no tiene clientId`);
    }
    await submitClientFiscalData(subscription.clientId, subscription.id, {
      rfc: choice.rfc,
      razonSocial: choice.razonSocial,
      constanciaBase64: choice.constanciaBase64,
      constanciaFileName: choice.constanciaFileName,
    });
  }

  const proposal = subscription.proposalId
    ? (await db.select().from(proposalsTable).where(eq(proposalsTable.id, subscription.proposalId)))[0]
    : undefined;
  const currency = proposal?.currency ?? "MXN";
  const baseAmount = parseFloat(subscription.amount);
  const { totalAmount: finalAmount } = applyFiscalInvoice(baseAmount, choice.requiresFiscalInvoice);

  const { paypalSubscriptionId, approveUrl } = await createSubscription(finalAmount, currency, String(subscription.id));
  await db.update(subscriptionsTable)
    .set({ paypalSubscriptionId, paypalApproveUrl: approveUrl, requiresFiscalInvoice: choice.requiresFiscalInvoice, updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscription.id));
}
