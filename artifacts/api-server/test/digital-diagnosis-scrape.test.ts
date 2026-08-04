import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { scrapeUrl, DigitalDiagnosisScrapeError } from "../src/lib/digital-diagnosis/scrape";

// scrapeUrl's fetch()-failure classification is what decides whether the
// prospect sees an actionable message ("verifica el dominio") or a generic
// one, and whether the resulting incident is worth high-severity triage
// (see public-digital-diagnosis.ts). Real prod case (incidents #4-#6): a
// typo'd domain sometimes throws a fetch() TypeError with no ENOTFOUND/
// EAI_AGAIN code at the top level (e.g. an AggregateError-wrapped
// dual-stack lookup), which used to fall through as an unclassified error.
// Any non-abort fetch() rejection must now map to the same friendly
// "unreachable domain" message.

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("scrapeUrl error classification", () => {
  test("AbortError maps to the timeout message", async () => {
    globalThis.fetch = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;

    await assert.rejects(
      scrapeUrl("https://example.com"),
      (err: unknown) => {
        assert.ok(err instanceof DigitalDiagnosisScrapeError);
        assert.match(err.message, /tardó demasiado/);
        return true;
      },
    );
  });

  test("a classic ENOTFOUND cause maps to the unreachable-domain message", async () => {
    globalThis.fetch = (async () => {
      const cause = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
      throw new TypeError("fetch failed", { cause });
    }) as typeof fetch;

    await assert.rejects(
      scrapeUrl("https://typo-domain-example.com"),
      (err: unknown) => {
        assert.ok(err instanceof DigitalDiagnosisScrapeError);
        assert.match(err.message, /Verifica que el dominio esté bien escrito/);
        return true;
      },
    );
  });

  test("a fetch failure with no matching top-level code still maps to the unreachable-domain message", async () => {
    globalThis.fetch = (async () => {
      // Real prod shape for incidents #4-#6: a plain fetch() TypeError
      // whose cause doesn't expose a top-level ENOTFOUND/EAI_AGAIN code.
      throw new TypeError("fetch failed", { cause: new AggregateError([], "all lookups failed") });
    }) as typeof fetch;

    await assert.rejects(
      scrapeUrl("https://another-typo-example.com"),
      (err: unknown) => {
        assert.ok(err instanceof DigitalDiagnosisScrapeError);
        assert.match(err.message, /Verifica que el dominio esté bien escrito/);
        return true;
      },
    );
  });

  test("a non-ok HTTP response maps to the site-error message", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 500 })) as typeof fetch;

    await assert.rejects(
      scrapeUrl("https://returns-500.example.com"),
      (err: unknown) => {
        assert.ok(err instanceof DigitalDiagnosisScrapeError);
        assert.match(err.message, /El sitio respondió con un error/);
        return true;
      },
    );
  });
});
