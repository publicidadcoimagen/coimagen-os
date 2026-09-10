// Write side of the Becky Beck legacy catalog (see becky-beck-legacy.ts for
// the read side and the full architecture note). Unlike the read path,
// which proxies through becky-beck-site's own public Netlify Functions
// (no token needed — Netlify auto-injects Blobs access inside its own
// Functions runtime), writes run on Render, outside that runtime, so they
// talk to Netlify Blobs directly via the SDK's "manual" configuration mode
// (siteID + token) — same pattern as the now-generalized
// product-images-blobs.ts, but targeting the original single-tenant
// "becky-beck" store/keys that becky-beck-site's products.mts and
// product-image.mts still read from, since that's the real 48-product data
// the public site actually serves (see P-77 in git history for the
// original single-tenant version of this, deleted when pendiente #5
// generalized the *new* clients onto Postgres — Becky's data itself was
// never migrated there).
import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Not secret — Netlify's own UI shows this as the "Project ID" for
// becky-beck-site. Only the token needs to be a real secret (Render env).
const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

// Exposed as a mockable object (rather than a plain function) so tests can
// swap in an in-memory fake store the same way test/impersonation.test.ts
// swaps db.select — a real ESM named import's binding can't be monkey-patched
// directly, but a method on an exported object can.
export const blobsClient = {
  getStore(): ReturnType<typeof getStore> {
    const token = process.env.NETLIFY_API_TOKEN;
    if (!token) {
      throw new Error("NETLIFY_API_TOKEN no está configurada — hace falta un Personal Access Token de Netlify para escribir el catálogo de Becky Beck.");
    }
    const siteID = process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID;
    return getStore({ name: "becky-beck", siteID, token });
  },
};

export interface BeckyBeckLegacyProductRecord {
  id: string;
  nameEs: string;
  nameEn: string;
  category: "bolso" | "mochila" | "llavero";
  priceUsd: number;
  available: boolean;
  imageKey: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const PRODUCTS_KEY = "products";

export async function listLegacyProductRecords(): Promise<BeckyBeckLegacyProductRecord[]> {
  const store = blobsClient.getStore();
  const products = await store.get(PRODUCTS_KEY, { type: "json" });
  return (products as BeckyBeckLegacyProductRecord[] | null) ?? [];
}

async function saveLegacyProductRecords(products: BeckyBeckLegacyProductRecord[]): Promise<void> {
  const store = blobsClient.getStore();
  await store.setJSON(PRODUCTS_KEY, products);
}

// becky-beck-site's product-image.mts always serves this store's image
// blobs with a hardcoded `Content-Type: image/jpeg`, regardless of what's
// actually stored — it doesn't read back any mime metadata. Restricting
// uploads to real JPEGs here (rather than accepting any image type like
// the original P-77 admin did) keeps what's stored consistent with how the
// public site will label and serve it.
const JPEG_DATA_URI_RE = /^data:(image\/jpe?g);base64,(.+)$/i;

export function decodeLegacyProductImage(dataUri: string): Buffer {
  const match = JPEG_DATA_URI_RE.exec(dataUri);
  if (!match) throw new Error("La imagen debe ser un JPEG (data:image/jpeg;base64,...) — el sitio público solo sirve este catálogo como image/jpeg.");
  return Buffer.from(match[2], "base64");
}

async function saveLegacyProductImage(imageKey: string, buffer: Buffer): Promise<void> {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const store = blobsClient.getStore();
  await store.set(imageKey, arrayBuffer);
}

async function deleteLegacyProductImage(imageKey: string): Promise<void> {
  const store = blobsClient.getStore();
  await store.delete(imageKey);
}

export async function createLegacyProduct(input: {
  nameEs: string;
  nameEn: string;
  category: "bolso" | "mochila" | "llavero";
  priceUsd: number;
  available: boolean;
  imageBase64?: string;
}): Promise<BeckyBeckLegacyProductRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: BeckyBeckLegacyProductRecord = {
    id,
    nameEs: input.nameEs,
    nameEn: input.nameEn,
    category: input.category,
    priceUsd: input.priceUsd,
    available: input.available,
    imageKey: null,
    createdAt: now,
    updatedAt: null,
  };

  if (input.imageBase64) {
    const buffer = decodeLegacyProductImage(input.imageBase64);
    const imageKey = `images/${id}`;
    await saveLegacyProductImage(imageKey, buffer);
    record.imageKey = imageKey;
  }

  const products = await listLegacyProductRecords();
  products.push(record);
  await saveLegacyProductRecords(products);
  return record;
}

export async function updateLegacyProduct(
  id: string,
  input: {
    nameEs?: string;
    nameEn?: string;
    category?: "bolso" | "mochila" | "llavero";
    priceUsd?: number;
    available?: boolean;
    imageBase64?: string;
  },
): Promise<BeckyBeckLegacyProductRecord | null> {
  const products = await listLegacyProductRecords();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const existing = products[index];
  const updated: BeckyBeckLegacyProductRecord = {
    ...existing,
    nameEs: input.nameEs ?? existing.nameEs,
    nameEn: input.nameEn ?? existing.nameEn,
    category: input.category ?? existing.category,
    priceUsd: input.priceUsd ?? existing.priceUsd,
    available: input.available ?? existing.available,
    updatedAt: new Date().toISOString(),
  };

  if (input.imageBase64) {
    const buffer = decodeLegacyProductImage(input.imageBase64);
    const imageKey = existing.imageKey ?? `images/${existing.id}`;
    await saveLegacyProductImage(imageKey, buffer);
    updated.imageKey = imageKey;
  }

  products[index] = updated;
  await saveLegacyProductRecords(products);
  return updated;
}

export async function deleteLegacyProduct(id: string): Promise<boolean> {
  const products = await listLegacyProductRecords();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const [removed] = products.splice(index, 1);
  await saveLegacyProductRecords(products);
  if (removed.imageKey) {
    await deleteLegacyProductImage(removed.imageKey);
  }
  return true;
}
