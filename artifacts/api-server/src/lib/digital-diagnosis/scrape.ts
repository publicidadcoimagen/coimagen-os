import * as cheerio from "cheerio";

const MAX_TEXT_SAMPLE = 12000;
const FETCH_TIMEOUT_MS = 10000;

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
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CoimagenDiagnosisBot/1.0; +https://www.coimagenmedia.com)",
      },
    });
    if (!response.ok) {
      throw new Error(`El sitio respondió con error HTTP ${response.status}`);
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
