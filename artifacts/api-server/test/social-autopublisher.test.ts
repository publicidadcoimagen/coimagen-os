import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCaptionPrompt } from "../src/lib/social-autopublisher/caption";
import { buildMetricoolPublishRequest } from "../src/lib/social-autopublisher/publisher";

// These only exercise pure logic (prompt/request building) — no DB
// connection and no real HTTP call to DeepSeek/Metricool, per the
// no-real-spend policy for Autopublicador Social until an explicit
// end-to-end test is greenlit.
//
// The /submit, /approve, /publish route handlers in content-calendar.ts
// (draft -> pending_approval -> approved -> published) are not covered
// here: their status-transition guards are trivial single-field checks
// inlined in the handler, matching the existing untested /approve and
// /publish siblings in the same file (shipped in P-33) — extracting them
// into a separately-tested pure function just for the new /submit handler
// would leave its two siblings still uncovered and inconsistent. Testing
// all three properly would need supertest against a real/test DB, which
// is a bigger, separate undertaking than today's scope.

describe("buildCaptionPrompt", () => {
  test("includes the topic, networks, and default tone", () => {
    const prompt = buildCaptionPrompt({ topic: "Sábados abiertos", networks: ["meta_instagram", "linkedin"] });
    assert.match(prompt, /Sábados abiertos/);
    assert.match(prompt, /meta_instagram, linkedin/);
    assert.match(prompt, /cercano y profesional/);
  });

  test("uses a custom tone when given", () => {
    const prompt = buildCaptionPrompt({ topic: "Promo", networks: ["linkedin"], tone: "formal y corporativo" });
    assert.match(prompt, /formal y corporativo/);
  });
});

describe("buildMetricoolPublishRequest", () => {
  const creds = { userToken: "test-token", userId: "test-user", blogId: "test-blog" };

  test("puts userId and blogId as query params, userToken in X-Mc-Auth header", () => {
    const { url, headers } = buildMetricoolPublishRequest(
      { network: "linkedin", caption: "hola" },
      creds,
    );
    assert.match(url, /userId=test-user/);
    assert.match(url, /blogId=test-blog/);
    assert.equal(headers["X-Mc-Auth"], "test-token");
  });

  test("maps internal network names to Metricool provider names", () => {
    const facebook = buildMetricoolPublishRequest({ network: "meta_facebook", caption: "hola" }, creds);
    assert.deepEqual(facebook.body.providers, ["facebook"]);

    const instagram = buildMetricoolPublishRequest({ network: "meta_instagram", caption: "hola" }, creds);
    assert.deepEqual(instagram.body.providers, ["instagram"]);
  });

  test("throws for a network with no Metricool mapping yet", () => {
    assert.throws(
      () => buildMetricoolPublishRequest({ network: "tiktok", caption: "hola" }, creds),
      /Red "tiktok" no tiene mapeo/,
    );
  });

  test("sets autoPublish true and defaults media to an empty array", () => {
    const { body } = buildMetricoolPublishRequest({ network: "linkedin", caption: "hola" }, creds);
    assert.equal(body.autoPublish, true);
    assert.deepEqual(body.media, []);
  });

  test("passes through mediaUrls when given", () => {
    const { body } = buildMetricoolPublishRequest(
      { network: "linkedin", caption: "hola", mediaUrls: ["https://example.com/a.jpg"] },
      creds,
    );
    assert.deepEqual(body.media, ["https://example.com/a.jpg"]);
  });
});
