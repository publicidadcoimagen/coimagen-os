import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { jotformWebhookHandler } from "../src/routes/webhooks-jotform";

// Only exercises the gates that run before any DB access (secret check,
// payload validation) — the success path needs a real database, same
// limitation as webhooks-resend.test.ts. What matters here is that a
// request without the right secret, or without enough identifying info to
// dedupe/contact a lead, never reaches the insert/update.

const TEST_SECRET = "test-jotform-secret-not-for-real-use";

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

function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return { headers, body } as unknown as Request;
}

describe("jotformWebhookHandler", () => {
  let originalSecret: string | undefined;

  before(() => {
    originalSecret = process.env.JOTFORM_WEBHOOK_SECRET;
  });

  after(() => {
    process.env.JOTFORM_WEBHOOK_SECRET = originalSecret;
  });

  test("returns 503 when JOTFORM_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.JOTFORM_WEBHOOK_SECRET;
    const req = createMockRequest({ name: "Ana", phone: "+526641234567" });
    const res = createMockResponse();

    await jotformWebhookHandler(req, res);

    assert.equal(res.statusCode, 503);
  });

  test("rejects a request with a missing/wrong secret header", async () => {
    process.env.JOTFORM_WEBHOOK_SECRET = TEST_SECRET;
    const req = createMockRequest(
      { name: "Ana", phone: "+526641234567" },
      { "x-jotform-webhook-secret": "wrong-secret" },
    );
    const res = createMockResponse();

    await jotformWebhookHandler(req, res);

    assert.equal(res.statusCode, 401);
  });

  test("rejects a correctly-authenticated payload with neither phone nor email", async () => {
    process.env.JOTFORM_WEBHOOK_SECRET = TEST_SECRET;
    const req = createMockRequest(
      { name: "Ana" },
      { "x-jotform-webhook-secret": TEST_SECRET },
    );
    const res = createMockResponse();

    await jotformWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("rejects a correctly-authenticated payload with no name", async () => {
    process.env.JOTFORM_WEBHOOK_SECRET = TEST_SECRET;
    const req = createMockRequest(
      { phone: "+526641234567" },
      { "x-jotform-webhook-secret": TEST_SECRET },
    );
    const res = createMockResponse();

    await jotformWebhookHandler(req, res);

    assert.equal(res.statusCode, 400);
  });
});
