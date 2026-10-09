// Every email that sends someone to the dashboard must link to
// portal.coimagenmedia.com — os.coimagenmedia.com never existed (NXDOMAIN).
// The Resend SDK posts through global fetch, so a fetch stub captures the
// exact HTML each email would send; nothing leaves this process.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Invoice } from "@workspace/db";
import { sendPaymentConfirmedEmail } from "../src/lib/payment-schedule/payment-confirmed-email";
import { sendPaymentFailedClientEmail } from "../src/lib/subscription-alerts/email";
import { sendStaffAlertEmail } from "../src/lib/invoice-reminders/email";

let realFetch: typeof fetch;
let realKey: string | undefined;
let sentHtml: string[];

before(() => {
  realFetch = globalThis.fetch;
  realKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_not_real";
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    sentHtml.push(String(JSON.parse(String(init?.body ?? "{}")).html ?? ""));
    return new Response(JSON.stringify({ id: "email-test" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
});

async function htmlOf(send: () => Promise<unknown>): Promise<string> {
  sentHtml = [];
  await send();
  assert.equal(sentHtml.length, 1, "exactly one email sent");
  return sentHtml[0];
}

describe("email links point at portal.coimagenmedia.com, never the dead os.coimagenmedia.com", () => {
  test("payment confirmed (client): 'Ir a tu portal' → portal login", async () => {
    const html = await htmlOf(() => sendPaymentConfirmedEmail("c@example.com", "Tienda", "P1-1", "1500", "MXN", false));
    assert.ok(html.includes(`href="https://portal.coimagenmedia.com/"`));
    assert.ok(!html.includes("os.coimagenmedia.com"));
  });

  test("payment failed (client): 'Iniciar sesión' → portal login", async () => {
    const html = await htmlOf(() => sendPaymentFailedClientEmail("c@example.com", "Tienda", "Growth", "297"));
    assert.ok(html.includes(`href="https://portal.coimagenmedia.com/"`));
    assert.ok(!html.includes("os.coimagenmedia.com"));
  });

  test("invoice reminder (staff): 'Ver facturación' → portal /revenue", async () => {
    const invoice = { id: 1, number: "INV-1", amount: "1500", currency: "MXN", dueDate: "2026-10-01", clientId: 1 } as unknown as Invoice;
    const html = await htmlOf(() => sendStaffAlertEmail(invoice, "Tienda", "overdue"));
    assert.ok(html.includes("https://portal.coimagenmedia.com/revenue"));
    assert.ok(!html.includes("os.coimagenmedia.com"));
  });
});
