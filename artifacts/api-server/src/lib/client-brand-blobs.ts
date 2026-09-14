import { getStore } from "@netlify/blobs";
import { decodeImageDataUri } from "./product-images-blobs";

// Fourth Netlify Blobs store in this codebase, same house pattern as
// becky-beck-blobs.ts, fiscal-blobs.ts, and product-images-blobs.ts — own
// named store, same site/token, reuses product-images-blobs.ts's data-URI
// decode/mime-validation instead of duplicating it.
const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

function getClientBrandStore() {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    throw new Error("NETLIFY_API_TOKEN no está configurada — hace falta un Personal Access Token de Netlify para leer/escribir el logo del cliente.");
  }
  const siteID = process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID;
  return getStore({ name: "client-brand-logos", siteID, token });
}

export function clientLogoKey(clientId: number): string {
  return `logos/${clientId}`;
}

export async function saveClientLogo(clientId: number, dataUri: string): Promise<void> {
  const { buffer, mime } = decodeImageDataUri(dataUri);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const store = getClientBrandStore();
  await store.set(clientLogoKey(clientId), arrayBuffer, { metadata: { mime } });
}

export async function getClientLogo(clientId: number): Promise<{ buffer: Buffer; mime: string } | null> {
  const store = getClientBrandStore();
  const result = await store.getWithMetadata(clientLogoKey(clientId), { type: "arrayBuffer" });
  if (!result) return null;
  const mime = typeof result.metadata?.mime === "string" ? result.metadata.mime : "application/octet-stream";
  return { buffer: Buffer.from(result.data), mime };
}
