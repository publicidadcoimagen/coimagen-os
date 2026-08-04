import * as cheerio from "cheerio";

const MAX_TEXT_SAMPLE = 12000;
const FETCH_TIMEOUT_MS = 10000;

// Thrown for scrape failures whose cause is known well enough to tell the
// prospect something actionable (bad domain, slow site, site-side error) —
// as opposed to unexpected errors, which should stay generic rather than
// leak internal detail to a public, unauthenticated endpoint.
export class DigitalDiagnosisScrapeError extends Error {
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = "DigitalDiagnosisScrapeError";
  }
}

export interface ScrapedSignals {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  hasViewportMeta: boolean;
  language: string | null;
  hasSsl: boolean;
  h1Count: number;
  wordCount: number;
  internalLinksCount: number;
  externalLinksCount: number;
  textSample: string;
}

export async function scrapeUrl(url: string): Promise<ScrapedSignals> {
  const parsed = new URL(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CoimagenDiagnosisBot/1.0; +https://www.coimagenmedia.com)",
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new DigitalDiagnosisScrapeError(
          "El sitio tardó demasiado en responder. Intenta de nuevo en unos minutos.",
          { cause: err },
        );
      }
      // Any other fetch()-level rejection (DNS not resolving, connection
      // refused, TLS failure, etc.) means the same thing to the prospect:
      // we couldn't reach that URL. The underlying cause shape varies too
      // much to enumerate reliably — undici's fetch() sometimes surfaces a
      // plain ENOTFOUND/EAI_AGAIN code, but dual-stack lookups can wrap it
      // in an AggregateError with no single top-level code (real prod case:
      // incidents #4-#6, same typo'd domain, "fetch failed" with no
      // matching code, fell through to a generic unhelpful message before
      // this fix). Treat any non-abort fetch() failure as unreachable.
      throw new DigitalDiagnosisScrapeError(
        "No pudimos acceder a esa URL. Verifica que el dominio esté bien escrito.",
        { cause: err },
      );
    }
    if (!response.ok) {
      throw new DigitalDiagnosisScrapeError(
        "El sitio respondió con un error. Verifica que la URL sea correcta.",
        { cause: new Error(`HTTP ${response.status}`) },
      );
    }
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const language = $("html").attr("lang")?.trim() || null;
  const h1Count = $("h1").length;

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.length > 0 ? bodyText.split(" ").filter(Boolean).length : 0;
  const textSample = bodyText.slice(0, MAX_TEXT_SAMPLE);

  let internalLinksCount = 0;
  let externalLinksCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === parsed.hostname) internalLinksCount++;
      else externalLinksCount++;
    } catch {
      // ignore unparseable hrefs
    }
  });

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    hasViewportMeta,
    language,
    hasSsl: parsed.protocol === "https:",
    h1Count,
    wordCount,
    internalLinksCount,
    externalLinksCount,
    textSample,
  };
}
