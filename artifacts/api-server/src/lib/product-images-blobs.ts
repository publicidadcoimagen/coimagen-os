import { getStore } from "@netlify/blobs";

// Third Netlify Blobs store in this codebase, same house pattern as
// lib/becky-beck-blobs.ts and lib/fiscal-blobs.ts — own named store, same
// site/token. Generalizes Becky Beck's single-tenant image storage into a
// shared store namespaced per client/product, so a second ecommerce client
// doesn't need its own store name hardcoded in.
const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

function getProductImagesStore() {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    throw new Error("NETLIFY_API_TOKEN no está configurada — hace falta un Personal Access Token de Netlify para leer/escribir imágenes de productos.");
  }
  const siteID = process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID;
  return getStore({ name: "product-images", siteID, token });
}

const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Unlike Becky Beck's original imageBase64 handling (any string matching
// the data-URI shape was accepted, no mime check), this validates the mime
// type server-side rather than trusting the frontend's <input accept="...">
// — same standard fiscal-blobs.ts already applies to PDFs.
export function decodeImageDataUri(dataUri: string): { buffer: Buffer; mime: string } {
  const match = DATA_URI_RE.exec(dataUri);
  if (!match) throw new Error("La imagen debe ser un data URI válido (data:<mime>;base64,<data>)");
  const [, mime, base64Data] = match;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    throw new Error(`Tipo de imagen no permitido: ${mime}. Usa JPEG, PNG, WEBP o GIF.`);
  }
  return { buffer: Buffer.from(base64Data, "base64"), mime };
}

export function productImageKey(clientId: number, productId: string, index: number): string {
  return `images/${clientId}/${productId}/${index}`;
}

export async function saveProductImage(imageKey: string, dataUri: string): Promise<void> {
  const { buffer, mime } = decodeImageDataUri(dataUri);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const store = getProductImagesStore();
  // Mime stored as blob metadata (not derivable from bytes alone without a
  // sniffing dependency) so the serving route can set the right
  // Content-Type without re-deriving it from the key or guessing.
  await store.set(imageKey, arrayBuffer, { metadata: { mime } });
}

export async function getProductImage(imageKey: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const store = getProductImagesStore();
  const result = await store.getWithMetadata(imageKey, { type: "arrayBuffer" });
  if (!result) return null;
  const mime = typeof result.metadata?.mime === "string" ? result.metadata.mime : "application/octet-stream";
  return { buffer: Buffer.from(result.data), mime };
}

export async function deleteProductImage(imageKey: string): Promise<void> {
  const store = getProductImagesStore();
  await store.delete(imageKey);
}
