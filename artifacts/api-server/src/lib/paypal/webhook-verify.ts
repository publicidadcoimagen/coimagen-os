import { paypalApiBase, getPaypalAccessToken } from "./client";

// Verifies a PayPal webhook via their own server-to-server
// verify-webhook-signature REST API (POST /v1/notifications/verify-webhook-signature)
// rather than reimplementing local certificate-chain verification — this
// SDK doesn't cover webhooks at all (no controller for it), and PayPal's
// own API round-trip is officially supported and far less error-prone than
// hand-rolled crypto. Unlike Resend's Svix verification, this tolerates an
// ordinary parsed JSON body (PayPal re-parses on their end) — no
// express.raw() needed, same house style as webhooks-jotform.ts.
export async function verifyPaypalWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  webhookEvent: unknown,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // Fails closed, same as webhooks-jotform.ts when JOTFORM_WEBHOOK_SECRET
    // is unset — an unconfigured verifier must never be treated as "skip
    // verification", or every request would sail through unauthenticated.
    throw new Error("PAYPAL_WEBHOOK_ID no está configurada");
  }

  const header = (name: string): string | undefined => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const accessToken = await getPaypalAccessToken();
  const res = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
