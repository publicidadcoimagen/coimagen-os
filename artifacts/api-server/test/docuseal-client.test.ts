import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  createDocusealSubmission,
  DocusealApiError,
  DocusealNotConfiguredError,
} from "../src/lib/docuseal/client";

// Stubs global fetch (same pattern as fiscal-email.test.ts) to verify the
// request shape sent to DocuSeal's real API without hitting the network —
// verified against the actual deployed source of the self-hosted instance
// (config/routes.rb, api/submissions_controller.rb,
// params/submission_create_validator.rb, submitters/serialize_for_api.rb)
// rather than assumed from generic docs, since the webhook side of this
// integration already burned time on a wrong generic assumption once.

describe("createDocusealSubmission", () => {
  let originalBaseUrl: string | undefined;
  let originalToken: string | undefined;

  before(() => {
    originalBaseUrl = process.env.DOCUSEAL_BASE_URL;
    originalToken = process.env.DOCUSEAL_API_TOKEN;
  });

  after(() => {
    if (originalBaseUrl === undefined) delete process.env.DOCUSEAL_BASE_URL;
    else process.env.DOCUSEAL_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.DOCUSEAL_API_TOKEN;
    else process.env.DOCUSEAL_API_TOKEN = originalToken;
  });

  test("throws DocusealNotConfiguredError when env vars are missing", async () => {
    delete process.env.DOCUSEAL_BASE_URL;
    delete process.env.DOCUSEAL_API_TOKEN;

    await assert.rejects(
      () => createDocusealSubmission(3, { email: "a@b.com", name: "A" }),
      DocusealNotConfiguredError,
    );
  });

  test("posts to {baseUrl}/api/submissions with X-Auth-Token and the expected body shape", async (t) => {
    process.env.DOCUSEAL_BASE_URL = "https://firmas.example.com";
    process.env.DOCUSEAL_API_TOKEN = "test-token-not-for-real-use";

    let capturedUrl: string | undefined;
    let capturedHeaders: Headers | undefined;
    let capturedBody: Record<string, unknown> | undefined;

    t.mock.method(globalThis, "fetch", async (url: unknown, options: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = new Headers(options.headers);
      capturedBody = JSON.parse(options.body as string);
      return new Response(
        JSON.stringify([{
          id: 42,
          submission_id: 7,
          external_id: "123",
          embed_src: "https://firmas.example.com/s/abc123",
          status: "sent",
        }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await createDocusealSubmission(3, {
      email: "cliente@example.com",
      name: "Dr. Segovia",
      role: "Primera Parte",
      externalId: "123",
    });

    assert.equal(capturedUrl, "https://firmas.example.com/api/submissions");
    assert.equal(capturedHeaders!.get("x-auth-token"), "test-token-not-for-real-use");
    assert.equal(capturedBody!.template_id, 3);
    assert.equal(capturedBody!.send_email, true);
    assert.deepEqual(capturedBody!.submitters, [{
      email: "cliente@example.com",
      name: "Dr. Segovia",
      role: "Primera Parte",
      external_id: "123",
    }]);

    assert.equal(result.submitterId, 42);
    assert.equal(result.submissionId, 7);
    assert.equal(result.externalId, "123");
    assert.equal(result.signingUrl, "https://firmas.example.com/s/abc123");
    assert.equal(result.status, "sent");
  });

  test("strips a trailing slash from DOCUSEAL_BASE_URL", async (t) => {
    process.env.DOCUSEAL_BASE_URL = "https://firmas.example.com/";
    process.env.DOCUSEAL_API_TOKEN = "test-token-not-for-real-use";

    let capturedUrl: string | undefined;
    t.mock.method(globalThis, "fetch", async (url: unknown) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify([{ id: 1, submission_id: 1, external_id: null, embed_src: null, status: "pending" }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await createDocusealSubmission(4, { email: "a@b.com", name: "A" });

    assert.equal(capturedUrl, "https://firmas.example.com/api/submissions");
  });

  test("throws DocusealApiError on a non-2xx response, with the response body in the message", async (t) => {
    process.env.DOCUSEAL_BASE_URL = "https://firmas.example.com";
    process.env.DOCUSEAL_API_TOKEN = "test-token-not-for-real-use";

    t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ error: "Template not found" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }));

    await assert.rejects(
      () => createDocusealSubmission(3, { email: "a@b.com", name: "A" }),
      (err: unknown) => {
        assert.ok(err instanceof DocusealApiError);
        assert.equal(err.status, 422);
        assert.match(err.message, /Template not found/);
        return true;
      },
    );
  });

  test("throws DocusealApiError when the response has no submitters", async (t) => {
    process.env.DOCUSEAL_BASE_URL = "https://firmas.example.com";
    process.env.DOCUSEAL_API_TOKEN = "test-token-not-for-real-use";

    t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));

    await assert.rejects(
      () => createDocusealSubmission(3, { email: "a@b.com", name: "A" }),
      DocusealApiError,
    );
  });
});
