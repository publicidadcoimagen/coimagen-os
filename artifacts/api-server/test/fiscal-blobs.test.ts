import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decodePdfDataUri } from "../src/lib/fiscal-blobs";

describe("decodePdfDataUri", () => {
  test("accepts a valid application/pdf data URI", () => {
    const base64 = Buffer.from("%PDF-1.4 fake content").toString("base64");
    const buffer = decodePdfDataUri(`data:application/pdf;base64,${base64}`);
    assert.equal(buffer.toString(), "%PDF-1.4 fake content");
  });

  test("rejects a non-PDF mime type even if it's a well-formed data URI", () => {
    const base64 = Buffer.from("not a pdf").toString("base64");
    assert.throws(() => decodePdfDataUri(`data:image/png;base64,${base64}`), /Solo se aceptan archivos PDF/);
  });

  test("rejects a malformed data URI", () => {
    assert.throws(() => decodePdfDataUri("not-a-data-uri"), /data URI válido/);
  });

  test("rejects a plain base64 string with no data URI prefix", () => {
    const base64 = Buffer.from("%PDF-1.4").toString("base64");
    assert.throws(() => decodePdfDataUri(base64), /data URI válido/);
  });
});
