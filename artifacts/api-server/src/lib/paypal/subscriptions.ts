import { getPaypalClient } from "./client";

// A PayPal billing plan has ONE currency, and a per-subscription price
// override cannot change it: overriding a USD plan with an MXN price fails
// with 422 CURRENCY_MISMATCH (verified against the sandbox plan
// 2026-10-06 — MXN → 422, USD → 201). So each currency needs its own plan:
// PAYPAL_PLAN_ID_MXN / PAYPAL_PLAN_ID_USD. The legacy single
// PAYPAL_PLAN_ID is still used as a fallback so existing config keeps
// working for whatever currency that plan was created in.
export function planIdForCurrency(currency: string, env: Record<string, string | undefined> = process.env): string | null {
  return env[`PAYPAL_PLAN_ID_${currency.toUpperCase()}`] || env.PAYPAL_PLAN_ID || null;
}

export class PaypalPlanCurrencyError extends Error {}

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
  const planId = planIdForCurrency(currency);
  if (!planId) {
    throw new PaypalPlanCurrencyError(`No hay plan de PayPal para ${currency}: configura PAYPAL_PLAN_ID_${currency.toUpperCase()}`);
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
  }).catch((err: unknown) => {
    const e = err as { body?: unknown; result?: unknown };
    const detail = `${typeof e?.body === "string" ? e.body : ""} ${JSON.stringify(e?.result ?? "")} ${String(err)}`;
    if (detail.includes("CURRENCY_MISMATCH")) {
      throw new PaypalPlanCurrencyError(`El plan de PayPal configurado no está en ${currency}: crea un plan en ${currency} y configúralo en PAYPAL_PLAN_ID_${currency.toUpperCase()}`);
    }
    throw err;
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
