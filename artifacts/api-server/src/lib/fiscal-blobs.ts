import { getStore } from "@netlify/blobs";

// Same Netlify Blobs pattern as lib/becky-beck-blobs.ts, own store so
// fiscal documents (sensitive: RFC, constancias, real CFDIs) never share a
// namespace with public product photos. Reuses the same site/token —
// there's only one Netlify site involved, just a different named store.
const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

function getFiscalBlobsStore() {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    throw new Error("NETLIFY_API_TOKEN no está configurada — hace falta para guardar documentos fiscales.");
  }
  const siteID = process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID;
  return getStore({ name: "fiscal-documents", siteID, token });
}

const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

// Unlike Becky Beck's imageBase64 (any image/*, unvalidated), fiscal
// documents (constancias, CFDIs) are always PDFs — reject anything else
// server-side rather than trusting the frontend's <input accept="...">.
export function decodePdfDataUri(dataUri: string): Buffer {
  const match = DATA_URI_RE.exec(dataUri);
  if (!match) throw new Error("El archivo debe ser un data URI válido (data:<mime>;base64,<data>)");
  const [, mime, base64Data] = match;
  if (mime !== "application/pdf") throw new Error("Solo se aceptan archivos PDF");
  return Buffer.from(base64Data, "base64");
}

export async function saveFiscalDocument(fileKey: string, dataUri: string): Promise<void> {
  const buffer = decodePdfDataUri(dataUri);
  // Buffer.from() always backs onto a real ArrayBuffer, never a
  // SharedArrayBuffer — the cast just narrows TS's ArrayBufferLike union
  // to match @netlify/blobs' BlobInput type.
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const store = getFiscalBlobsStore();
  await store.set(fileKey, arrayBuffer);
}

export async function getFiscalDocument(fileKey: string): Promise<Buffer | null> {
  const store = getFiscalBlobsStore();
  const arrayBuffer = await store.get(fileKey, { type: "arrayBuffer" });
  return arrayBuffer ? Buffer.from(arrayBuffer) : null;
}
