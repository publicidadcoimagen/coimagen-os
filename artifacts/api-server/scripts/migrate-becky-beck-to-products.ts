// One-off migration: moves Becky Beck's real product catalog from the old
// single-tenant Netlify Blobs store ("becky-beck", key "products") into the
// new multi-tenant `products` table, re-keying images under the new
// "product-images" store namespaced by clientId/productId.
//
// NOT executed as part of this branch — deliberately. This touches real
// production data (Becky Beck's actual catalog) and the `products` table
// schema hasn't been pushed to Neon yet either (conservation mode, see
// [[neon-conservation-mode-until-2026-09-01]]). Run manually, once, after:
//   1. This branch is reviewed and the `products`/`orders` schema is pushed
//      to Neon (drizzle-kit push).
//   2. Becky Beck's clientId in the `clients` table is confirmed.
//   3. NETLIFY_API_TOKEN and DATABASE_URL are set in the environment this
//      runs in.
//
// Usage: tsx scripts/migrate-becky-beck-to-products.ts <beckyBeckClientId>

import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { productImageKey, saveProductImage } from "../src/lib/product-images-blobs";

interface OldBeckyBeckProductRecord {
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

const DEFAULT_SITE_ID = "b70d0fc1-b98a-4a42-b764-8eed8eea1a7e";

async function readOldImageDataUri(imageKey: string): Promise<string | null> {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw new Error("NETLIFY_API_TOKEN no configurada");
  const store = getStore({ name: "becky-beck", siteID: process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID, token });
  const arrayBuffer = await store.get(imageKey, { type: "arrayBuffer" });
  if (!arrayBuffer) return null;
  // Old store never recorded mime type — every real Becky Beck upload so
  // far has been a phone photo, so jpeg is a safe assumption for this
  // one-off migration; verify against real files before running for real.
  return `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}

async function main() {
  const clientId = Number(process.argv[2]);
  if (!Number.isInteger(clientId)) {
    throw new Error("Uso: tsx scripts/migrate-becky-beck-to-products.ts <beckyBeckClientId>");
  }

  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw new Error("NETLIFY_API_TOKEN no configurada");
  const oldStore = getStore({ name: "becky-beck", siteID: process.env.BECKY_BECK_SITE_ID ?? DEFAULT_SITE_ID, token });
  const products = ((await oldStore.get("products", { type: "json" })) as OldBeckyBeckProductRecord[] | null) ?? [];

  console.log(`Migrando ${products.length} productos al cliente ${clientId}...`);

  for (const old of products) {
    const [row] = await db.insert(productsTable).values({
      clientId,
      nameEs: old.nameEs,
      nameEn: old.nameEn,
      category: old.category,
      priceCents: Math.round(old.priceUsd * 100),
      currency: "USD",
      available: old.available,
      imageKeys: [],
    }).returning();

    let imageKeys: string[] = [];
    if (old.imageKey) {
      const dataUri = await readOldImageDataUri(old.imageKey);
      if (dataUri) {
        const newKey = productImageKey(clientId, row.id, 0);
        await saveProductImage(newKey, dataUri);
        imageKeys = [newKey];
      }
    }

    await db.update(productsTable).set({ imageKeys }).where(eq(productsTable.id, row.id));
    console.log(`  ✓ ${old.nameEs} → ${row.id}`);
  }

  console.log("Migración completa. Verificar productos en la tabla antes de considerar el store viejo obsoleto.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
