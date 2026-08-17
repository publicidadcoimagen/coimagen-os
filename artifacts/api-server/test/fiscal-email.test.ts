import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { sendFiscalInvoiceAlertEmail } from "../src/lib/fiscal-data/email";

// The accountant needs to receive this alert directly (with Camila CC'd) so
// she can issue the real CFDI without Camila having to forward it manually.
// Stubs global fetch — the resend SDK's HTTP call — to capture the request
// body instead of hitting the network, and asserts the recipient/cc fields
// without depending on a real RESEND_API_KEY.

describe("sendFiscalInvoiceAlertEmail", () => {
  let originalApiKey: string | undefined;

  before(() => {
    originalApiKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test-resend-key-not-for-real-use";
  });

  after(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
  });

  test("sends the accountant alert to contaapp.cdmx@gmail.com with Camila CC'd", async (t) => {
    let capturedBody: Record<string, unknown> | undefined;

    t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
      capturedBody = JSON.parse(options.body as string);
      return new Response(JSON.stringify({ id: "test-email-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const id = await sendFiscalInvoiceAlertEmail({
      clientName: "Cliente de Prueba",
      label: "Anticipo (50%)",
      rfc: "XAXX010101000",
      razonSocial: "Cliente de Prueba S.A. de C.V.",
      amount: 5800,
      ivaAmount: 800,
      currency: "MXN",
      constanciaBuffer: Buffer.from("%PDF-1.4 fake constancia"),
      constanciaFileName: "constancia.pdf",
    });

    assert.equal(id, "test-email-id");
    assert.ok(capturedBody, "expected the resend SDK to issue a fetch request");
    assert.equal(capturedBody!.to, "contaapp.cdmx@gmail.com");
    assert.equal(capturedBody!.cc, "info@coimagenmedia.com");
  });
});
