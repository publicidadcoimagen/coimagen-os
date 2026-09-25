import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { slugifyClientName, nextFreeSlug } from "../src/lib/client-room/ensure-organization";

describe("slugifyClientName", () => {
  test("lowercase with dashes", () => {
    assert.equal(slugifyClientName("Milevia Ubers Flotilla"), "milevia-ubers-flotilla");
  });
  test("strips accents and ñ", () => {
    assert.equal(slugifyClientName("Clínica Peñasco"), "clinica-penasco");
  });
  test("collapses symbols and trims edge dashes", () => {
    assert.equal(slugifyClientName("  Dr. Segovia & Asociados, S.A. "), "dr-segovia-asociados-s-a");
  });
  test("falls back when nothing usable is left", () => {
    assert.equal(slugifyClientName("¡¡!!"), "cliente");
  });
  test("caps length without leaving a trailing dash", () => {
    const slug = slugifyClientName("a".repeat(59) + " b");
    assert.ok(slug.length <= 60);
    assert.ok(!slug.endsWith("-"));
  });
});

describe("nextFreeSlug", () => {
  test("base when free", () => {
    assert.equal(nextFreeSlug("becky-beck", []), "becky-beck");
  });
  test("adds -2 when taken", () => {
    assert.equal(nextFreeSlug("becky-beck", ["becky-beck"]), "becky-beck-2");
  });
  test("skips numbers already used", () => {
    assert.equal(nextFreeSlug("becky-beck", ["becky-beck", "becky-beck-2", "becky-beck-3"]), "becky-beck-4");
  });
});
