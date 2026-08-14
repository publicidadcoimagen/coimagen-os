import { getPaypalClient } from "./client";

export interface CreatedSubscription {
  paypalSubscriptionId: string;
  approveUrl: string;
}

// Called once a proposal's final installment is paid — creates a real
// PayPal subscription for the client's ongoing monthly plan, at the
// client-specific `monthlyAmount` (proposals.monthlyAmount), overriding
// the shared plan's default price via billingCycles[].pricingScheme.
// PAYPAL_PLAN_ID is a single reusable plan created ONCE via a manual setup
// step (see client.ts's comment) — not created per-client here.
//
// The returned `approveUrl` still requires the client to click through and
// authorize the recurring charge on PayPal's site — this call alone does
// NOT activate billing. See webhooks-paypal.ts for BILLING.SUBSCRIPTION.
// ACTIVATED, which is what actually flips subscriptions.status to "active".
export async function createSubscription(monthlyAmount: number, currency: string, customId: string): Promise<CreatedSubscription> {
  const planId = process.env.PAYPAL_PLAN_ID;
  if (!planId) {
    throw new Error("PAYPAL_PLAN_ID no está configurada");
  }

  const { subscriptions } = getPaypalClient();
  const { result } = await subscriptions.createSubscription({
    body: {
      planId,
      customId, // set to the subscriptions.id row so the webhook can look it up
      plan: {
        billingCycles: [
          {
            sequence: 1,
            pricingScheme: { fixedPrice: { currencyCode: currency, value: monthlyAmount.toFixed(2) } },
          },
        ],
      },
    },
    prefer: "return=representation",
  });

  if (!result.id) {
    throw new Error("PayPal no devolvió un subscription id");
  }
  const approveLink = result.links?.find((l) => l.rel === "approve");
  if (!approveLink?.href) {
    throw new Error("PayPal no devolvió un link de aprobación (rel=approve) para la suscripción");
  }

  return { paypalSubscriptionId: result.id, approveUrl: approveLink.href };
}
