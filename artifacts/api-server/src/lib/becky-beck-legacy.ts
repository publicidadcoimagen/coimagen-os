// Read-only proxy to Becky Beck's original P-77 storefront (a separate
// static site + Netlify Functions repo, becky-beck-site, deployed at
// beckybech.netlify.app — note the domain's own typo, not ours). That site's
// `/.netlify/functions/products` and `/product-image` Functions run on
// Netlify's own infra, where Netlify auto-injects Blobs access — unlike this
// server's now-deleted P-77 admin routes, they need no NETLIFY_API_TOKEN.
// They're also the live source of truth for Becky's real 48-product catalog;
// the newer Postgres `products` table (pendiente #5) never got that data
// migrated in and stays empty for her. This proxy exists so the Client Room
// catalog page can show her real catalog without duplicating it into
// Postgres or standing up write access again — see the corrected diagnosis
// in the P-catalog-connection session.
const LEGACY_SITE_URL = process.env.BECKY_BECK_LEGACY_SITE_URL ?? "https://beckybech.netlify.app";

export interface BeckyBeckLegacyProduct {
  id: string;
  nameEs: string;
  nameEn: string;
  category: "bolso" | "mochila" | "llavero";
  priceUsd: number;
  available: boolean;
  imageUrl: string | null;
}

export async function listLegacyProducts(): Promise<BeckyBeckLegacyProduct[]> {
  const res = await fetch(`${LEGACY_SITE_URL}/.netlify/functions/products`);
  if (!res.ok) throw new Error(`El catálogo original de Becky Beck respondió ${res.status}`);
  return res.json() as Promise<BeckyBeckLegacyProduct[]>;
}

export async function getLegacyProductImage(id: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const res = await fetch(`${LEGACY_SITE_URL}/.netlify/functions/product-image?id=${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`La imagen del producto ${id} respondió ${res.status}`);
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime };
}
