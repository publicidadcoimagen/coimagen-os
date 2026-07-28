import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { Webhook } from "svix";
import { resendWebhookHandler } from "../src/routes/webhooks-resend";

// Only exercises the signature-verification gate, which runs (and can
// reject) before any DB access — resendWebhookHandler's success path
// requires a real database, which this test suite doesn't have (see
// package.json's "test" script setting a fake DATABASE_URL). A bad/missing
// Svix signature must never reach the DB insert, since that's the one
// thing standing between this public endpoint and anyone spoofing delivery
// events for diagnoses they don't own.

const TEST_SECRET = "whsec_" + Buffer.from("test-secret-not-for-real-use-000000").toString("base64");

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function createMockRequest(body: Buffer, headers: Record<string, string>): Request {
  return { headers, body } as unknown as Request;
}

describe("resendWebhookHandler", () => {
  let originalSecret: string | undefined;

  before(() => {
    originalSecret = process.env.RESEND_WEBHOOK_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET;
  });

  after(() => {
    process.env.RESEND_WEBHOOK_SECRET = originalSecret;
  });

  test("rejects a request with no Svix headers", async () => {
    const req = createMockRequest(Buffer.from(JSON.stringify({ type: "email.delivered" })), {});
    const res = createMockResponse();

    await resendWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("rejects a request with a forged signature", async () => {
    const payload = Buffer.from(JSON.stringify({ type: "email.delivered", data: { email_id: "evt_1" } }));
    const req = createMockRequest(payload, {
      "svix-id": "msg_test",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,not-a-real-signature",
    });
    const res = createMockResponse();

    await resendWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("returns 500 when RESEND_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const req = createMockRequest(Buffer.from("{}"), {});
      const res = createMockResponse();

      await resendWebhookHandler(req, res);

      assert.equal(res.statusCode, 500);
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET;
    }
  });

  test("sanity: a correctly-signed payload passes Svix verification", () => {
    // Confirms TEST_SECRET/Webhook usage above actually produces a signature
    // svix accepts, so the two rejection tests above are testing the real
    // failure path and not an already-broken success path.
    const wh = new Webhook(TEST_SECRET);
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "evt_1" } });
    const timestamp = new Date();
    const signature = wh.sign("msg_test", timestamp, payload);
    const verified = wh.verify(payload, {
      "svix-id": "msg_test",
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    });
    assert.deepEqual(verified, { type: "email.delivered", data: { email_id: "evt_1" } });
  });
});
