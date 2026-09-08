import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { scrapeUrl, assertDomainResolves, DigitalDiagnosisScrapeError } from "../src/lib/digital-diagnosis/scrape";

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

// Audited all 15 real Quality Center incidents for this agent: exactly 4
// distinct malformed domains (a missing letter, a different missing letter,
// a doubled letter, and a ".con" TLD typo) account for 6 of them, and all
// 4 were independently confirmed live to fail DNS resolution with
// ENOTFOUND — while the correctly-spelled domains behind the other 9
// incidents (including coimagenmedia.com itself) resolve fine, confirming
// their failures are unrelated to the domain and must NOT be rejected here.
describe("assertDomainResolves", () => {
  test("rejects with a clear message on ENOTFOUND (the real shape of all 4 cited typo'd domains)", async () => {
    const lookup = async () => {
      const err = new Error("not found") as NodeJS.ErrnoException;
      err.code = "ENOTFOUND";
      throw err;
    };

    await assert.rejects(
      assertDomainResolves("https://neurocirjuanosentijuana.com", lookup),
      (err: unknown) => {
        assert.ok(err instanceof DigitalDiagnosisScrapeError);
        assert.match(err.message, /No encontramos ese dominio/);
        return true;
      },
    );
  });

  test("rejects on ENODATA the same way", async () => {
    const lookup = async () => {
      const err = new Error("no data") as NodeJS.ErrnoException;
      err.code = "ENODATA";
      throw err;
    };

    await assert.rejects(
      assertDomainResolves("https://no-data.example.com", lookup),
      (err: unknown) => err instanceof DigitalDiagnosisScrapeError,
    );
  });

  test("resolves without throwing for a domain that resolves (real domains behind the other 9 incidents)", async () => {
    const lookup = async () => ({ address: "185.199.109.153", family: 4 });
    await assert.doesNotReject(assertDomainResolves("https://www.coimagenmedia.com", lookup));
  });

  test("does not reject on a transient/unrelated DNS error — only ENOTFOUND/ENODATA are treated as a bad domain", async () => {
    const lookup = async () => {
      const err = new Error("server failure") as NodeJS.ErrnoException;
      err.code = "ESERVFAIL";
      throw err;
    };
    await assert.doesNotReject(assertDomainResolves("https://flaky-resolver.example.com", lookup));
  });
});
