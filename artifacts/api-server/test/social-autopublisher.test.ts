import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCaptionPrompt, findProhibitedClaim, isClaimBlockedError, assertNoProhibitedClaim } from "../src/lib/social-autopublisher/caption";
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
//
// The one exception is the prohibited-claims gate that POST /items and
// POST /items/:id/approve now both call before touching the DB — that
// logic is the pure assertNoProhibitedClaim() function below, tested
// directly rather than through the routes, same reasoning as
// findProhibitedClaim() itself.

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

describe("findProhibitedClaim", () => {
  // generateCaptionAndCreateDraft() calls this immediately after
  // generateCaption() and before the content_calendar_items insert, and
  // throws if it returns non-null — that call site can't be exercised here
  // without a real DeepSeek call and a live DB (generateCaptionAndCreateDraft
  // transitively imports @workspace/db, which requires DATABASE_URL at
  // import time), consistent with the no-real-spend/no-DB scope already
  // established for this test file. This covers the actual gate logic.

  test("flags a fabricated results-guarantee claim", () => {
    assert.equal(findProhibitedClaim("Resultados garantizados en 30 días."), "garantizados");
  });

  test("flags 'garantizado' and its variants", () => {
    assert.ok(findProhibitedClaim("Te lo garantizamos: más ventas este mes."));
    assert.ok(findProhibitedClaim("Éxito garantizado para tu negocio."));
  });

  test("flags absolute unsourced figures like 100% de resultados", () => {
    assert.ok(findProhibitedClaim("100% de resultados o te devolvemos tu dinero."));
  });

  test("flags market-leader superlatives", () => {
    assert.ok(findProhibitedClaim("Somos el mejor del mercado en marketing digital."));
    assert.ok(findProhibitedClaim("El número 1 en resultados de la ciudad."));
  });

  test("does not flag an ordinary caption with no fabricated claims", () => {
    assert.equal(
      findProhibitedClaim("Abrimos este sábado con promociones especiales. ¡Te esperamos! #Promo #FinDeSemana"),
      null,
    );
  });
});

describe("isClaimBlockedError", () => {
  // The content-calendar route's /items/generate catch uses this to pick
  // reportAgentFailure()'s category (claim_blocked vs generation_error)
  // and whether to notify a human — getting the classification wrong would
  // either silently drop a real DeepSeek outage or page someone for a
  // filter working as designed (Motor de Escalación §Decisiones #3).

  test("recognizes the exact prefix assertNoProhibitedClaim throws for a blocked claim", () => {
    assert.equal(
      isClaimBlockedError('Caption bloqueado: contiene una frase no permitida ("garantizados"). Ajusta el texto y vuelve a intentar.'),
      true,
    );
  });

  test("does not misclassify an unrelated DeepSeek/network error", () => {
    assert.equal(isClaimBlockedError("fetch failed"), false);
    assert.equal(isClaimBlockedError("DEEPSEEK_API_KEY no está configurada"), false);
  });
});

describe("assertNoProhibitedClaim", () => {
  // Reproduces the audit gap: a caption is only checked by
  // generateCaptionAndCreateDraft() when it comes from /items/generate.
  // A caption written by hand and posted straight to POST /items (or
  // edited in later via PATCH, which stays open through pending_approval)
  // never touches that call site and used to sail through to /publish
  // unchecked. assertNoProhibitedClaim() is now the single function both
  // POST /items (manual creation) and POST /items/:id/approve (the last
  // point before a caption is immutable and publishable) call, so this
  // exact manually-authored, non-generated caption is rejected wherever
  // it's checked, closing the gap regardless of which of the two routes
  // catches it first for a given item.
  test("rejects a manually-written caption with a prohibited claim, exactly as would reach POST /items or /approve without ever calling /generate", () => {
    const manuallyWrittenCaption = "Contáctanos hoy: resultados garantizados o te devolvemos tu dinero.";
    assert.throws(
      () => assertNoProhibitedClaim(manuallyWrittenCaption),
      /Caption bloqueado.*garantizados/,
    );
  });

  test("does not throw for a clean manually-written caption", () => {
    assert.doesNotThrow(() =>
      assertNoProhibitedClaim("Abrimos este sábado con promociones especiales. ¡Te esperamos!"),
    );
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
