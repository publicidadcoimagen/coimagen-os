import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  blobsClient,
  createLegacyProduct,
  updateLegacyProduct,
  deleteLegacyProduct,
  decodeLegacyProductImage,
  type BeckyBeckLegacyProductRecord,
} from "../src/lib/becky-beck-legacy-write";

// In-memory fake of the Netlify Blobs store, keyed the same way
// blobsClient.getStore() is used in becky-beck-legacy-write.ts: a JSON blob
// under "products" plus arbitrary binary blobs under "images/<id>". Mocking
// blobsClient.getStore (an exported object method, not the raw @netlify/blobs
// import) is what makes this possible without touching real Netlify infra —
// same boundary-mocking approach test/impersonation.test.ts uses for db.select.
function createFakeStore() {
  const json = new Map<string, unknown>();
  const blobs = new Map<string, ArrayBuffer>();
  return {
    store: {
      async get(key: string, _opts?: { type: string }) {
        return json.has(key) ? json.get(key) : null;
      },
      async setJSON(key: string, value: unknown) {
        json.set(key, value);
      },
      async set(key: string, value: ArrayBuffer) {
        blobs.set(key, value);
      },
      async delete(key: string) {
        blobs.delete(key);
      },
    },
    blobs,
  };
}

const ONE_PX_JPEG_DATA_URI =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

describe("becky-beck-legacy-write", () => {
  let fake: ReturnType<typeof createFakeStore>;

  beforeEach((t) => {
    fake = createFakeStore();
    t.mock.method(blobsClient, "getStore", () => fake.store as unknown as ReturnType<typeof blobsClient.getStore>);
  });

  test("createLegacyProduct adds a new record and returns it", async () => {
    const record = await createLegacyProduct({
      nameEs: "Bolso de prueba", nameEn: "Test bag", category: "bolso", priceUsd: 25, available: true,
    });

    assert.equal(record.nameEs, "Bolso de prueba");
    assert.equal(record.imageKey, null);
    assert.ok(record.id);

    const stored = (await fake.store.get("products", { type: "json" })) as BeckyBeckLegacyProductRecord[];
    assert.equal(stored.length, 1);
    assert.equal(stored[0].id, record.id);
  });

  test("createLegacyProduct with an image stores the JPEG blob and links imageKey", async () => {
    const record = await createLegacyProduct({
      nameEs: "Con imagen", nameEn: "With image", category: "mochila", priceUsd: 30, available: true,
      imageBase64: ONE_PX_JPEG_DATA_URI,
    });

    assert.equal(record.imageKey, `images/${record.id}`);
    assert.ok(fake.blobs.has(`images/${record.id}`));
  });

  test("createLegacyProduct rejects a non-JPEG image before writing anything", async () => {
    await assert.rejects(
      () => createLegacyProduct({
        nameEs: "x", nameEn: "x", category: "bolso", priceUsd: 1, available: true,
        imageBase64: "data:image/png;base64,AAAA",
      }),
      /JPEG/,
    );
    const stored = (await fake.store.get("products", { type: "json" })) as BeckyBeckLegacyProductRecord[] | null;
    assert.equal(stored, null, "no product should be saved when the image is rejected");
  });

  test("updateLegacyProduct merges fields onto the existing record and stamps updatedAt", async () => {
    const created = await createLegacyProduct({
      nameEs: "Original", nameEn: "Original", category: "llavero", priceUsd: 10, available: true,
    });

    const updated = await updateLegacyProduct(created.id, { priceUsd: 15, available: false });

    assert.ok(updated);
    assert.equal(updated!.priceUsd, 15);
    assert.equal(updated!.available, false);
    assert.equal(updated!.nameEs, "Original", "fields not included in the patch must be preserved");
    assert.ok(updated!.updatedAt);
  });

  test("updateLegacyProduct returns null for an id that doesn't exist", async () => {
    const result = await updateLegacyProduct("does-not-exist", { priceUsd: 5 });
    assert.equal(result, null);
  });

  test("deleteLegacyProduct removes the record and its image blob, returns true", async () => {
    const created = await createLegacyProduct({
      nameEs: "A borrar", nameEn: "To delete", category: "bolso", priceUsd: 20, available: true,
      imageBase64: ONE_PX_JPEG_DATA_URI,
    });
    assert.ok(fake.blobs.has(`images/${created.id}`));

    const deleted = await deleteLegacyProduct(created.id);

    assert.equal(deleted, true);
    const stored = (await fake.store.get("products", { type: "json" })) as BeckyBeckLegacyProductRecord[];
    assert.equal(stored.length, 0);
    assert.equal(fake.blobs.has(`images/${created.id}`), false, "the product's image blob must be cleaned up too");
  });

  test("deleteLegacyProduct returns false for an id that doesn't exist, without touching the store", async () => {
    await createLegacyProduct({ nameEs: "Otro", nameEn: "Other", category: "bolso", priceUsd: 5, available: true });
    const deleted = await deleteLegacyProduct("does-not-exist");
    assert.equal(deleted, false);
    const stored = (await fake.store.get("products", { type: "json" })) as BeckyBeckLegacyProductRecord[];
    assert.equal(stored.length, 1, "the real product must be untouched");
  });

  test("decodeLegacyProductImage accepts image/jpeg and image/jpg, rejects everything else", () => {
    assert.ok(decodeLegacyProductImage(ONE_PX_JPEG_DATA_URI) instanceof Buffer);
    assert.ok(decodeLegacyProductImage("data:image/jpg;base64,AAAA") instanceof Buffer);
    assert.throws(() => decodeLegacyProductImage("data:image/png;base64,AAAA"), /JPEG/);
    assert.throws(() => decodeLegacyProductImage("not-a-data-uri"), /JPEG/);
  });
});
