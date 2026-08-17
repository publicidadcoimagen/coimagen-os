import { Client, Environment, LogLevel } from "@paypal/paypal-server-sdk";
import { OrdersController, SubscriptionsController } from "@paypal/paypal-server-sdk";

// Single lazily-created client, mirroring the fail-loud-if-unconfigured
// pattern used by every other integration in this codebase (Resend,
// Jotform) — no silent fallback to a broken client.
let cached: { client: Client; orders: OrdersController; subscriptions: SubscriptionsController } | null = null;

export function getPaypalClient() {
  if (cached) return cached;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET no están configuradas");
  }

  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    timeout: 0,
    environment: process.env.PAYPAL_ENV === "live" ? Environment.Production : Environment.Sandbox,
    logging: { logLevel: LogLevel.Warn, logRequest: { logBody: false }, logResponse: { logHeaders: false } },
  });

  cached = {
    client,
    orders: new OrdersController(client),
    subscriptions: new SubscriptionsController(client),
  };
  return cached;
}

// PAYPAL_ENV defaults to "sandbox" whenever unset — this must never
// silently point at production. Required env vars for this whole module:
// PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID (webhook-verify.ts),
// PAYPAL_ENV ("sandbox" | "live"), PAYPAL_PLAN_ID (subscriptions.ts —
// created once via a manual one-time setup step, not by any
// request-handling code path here).

export function paypalApiBase(): string {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

// Used only by webhook-verify.ts's raw REST call — the SDK's Client
// handles OAuth internally for orders.ts/subscriptions.ts, but webhook
// signature verification isn't part of this SDK's covered surface (no
// webhook-related controller exists in it), so that one call goes direct.
export async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET no están configuradas");
  }
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener token OAuth de PayPal: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
