import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import type { Request, Response } from "express";
import { docusealWebhookHandler } from "../src/routes/webhooks-docuseal";

// Only exercises the signature-verification gate, which runs (and can
// reject) before any DB access — the success path needs a real database,
// same limitation as webhooks-resend.test.ts / webhooks-jotform.test.ts. A
// forged X-Docuseal-Signature must never reach the DB update, since that's
// the one thing standing between this public endpoint and anyone forging a
// "contract signed" event — exactly the legal gap this integration exists
// to close.

const TEST_SECRET = "test-docuseal-secret-not-for-real-use";

function sign(body: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

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

describe("docusealWebhookHandler", () => {
  let originalSecret: string | undefined;

  before(() => {
    originalSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  });

  after(() => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = originalSecret;
  });

  test("returns 503 when DOCUSEAL_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.DOCUSEAL_WEBHOOK_SECRET;
    const payload = Buffer.from(JSON.stringify({ event_type: "submission.completed" }));
    const req = createMockRequest(payload, {});
    const res = createMockResponse();

    await docusealWebhookHandler(req, res);

    assert.equal(res.statusCode, 503);
  });

  test("rejects a request with no signature header", async () => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = TEST_SECRET;
    const payload = Buffer.from(JSON.stringify({ event_type: "submission.completed" }));
    const req = createMockRequest(payload, {});
    const res = createMockResponse();

    await docusealWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("rejects a request with a forged signature", async () => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = TEST_SECRET;
    const payload = Buffer.from(JSON.stringify({ event_type: "submission.completed" }));
    const req = createMockRequest(payload, { "x-docuseal-signature": "0".repeat(64) });
    const res = createMockResponse();

    await docusealWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("rejects a signature computed with the wrong secret", async () => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = TEST_SECRET;
    const payload = Buffer.from(JSON.stringify({ event_type: "submission.completed" }));
    const req = createMockRequest(payload, { "x-docuseal-signature": sign(payload, "wrong-secret") });
    const res = createMockResponse();

    await docusealWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("acknowledges an unrecognized event type with a correctly-signed payload", async () => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = TEST_SECRET;
    const payload = Buffer.from(JSON.stringify({ event_type: "form.viewed" }));
    const req = createMockRequest(payload, { "x-docuseal-signature": sign(payload, TEST_SECRET) });
    const res = createMockResponse();

    await docusealWebhookHandler(req, res);

    assert.equal(res.statusCode, 200);
  });
});
