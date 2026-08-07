import { getStore } from "@netlify/blobs";

// Site ID is not secret (Netlify's own UI shows it as the "Project ID"),
// so it's safe to default here — only the access token needs to be a
// real secret, set on Render. See docs/n8n-vps-access.md-style note in
// the P-77 PR description for the exact env var to add.
const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

export interface BeckyBeckProductRecord {
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

function getBlobsStore() {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      "NETLIFY_API_TOKEN no está configurada — hace falta un Personal Access Token de Netlify para leer/escribir el catálogo de Becky Beck.",
    );
  }
  const siteID = process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID;
  return getStore({ name: "becky-beck", siteID, token });
}

const PRODUCTS_KEY = "products";

export async function listBeckyBeckProducts(): Promise<BeckyBeckProductRecord[]> {
  const store = getBlobsStore();
  const products = await store.get(PRODUCTS_KEY, { type: "json" });
  return (products as BeckyBeckProductRecord[] | null) ?? [];
}

export async function saveBeckyBeckProducts(products: BeckyBeckProductRecord[]): Promise<void> {
  const store = getBlobsStore();
  await store.setJSON(PRODUCTS_KEY, products);
}

export async function saveBeckyBeckProductImage(imageKey: string, dataUri: string): Promise<void> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!match) throw new Error("imageBase64 debe ser un data URI válido (data:<mime>;base64,<data>)");
  const [, , base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const store = getBlobsStore();
  await store.set(imageKey, arrayBuffer);
}

export async function deleteBeckyBeckProductImage(imageKey: string): Promise<void> {
  const store = getBlobsStore();
  await store.delete(imageKey);
}
