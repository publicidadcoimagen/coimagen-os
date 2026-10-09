import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientRoomModuleKeys, nextEnabledModules } from "./nav-modules";

describe("clientRoomModuleKeys — which module entries a Client Room nav shows", () => {
  test("staff (Abrir Client Room) see the room client's modules — any client, not just beckybeck", () => {
    assert.deepEqual(clientRoomModuleKeys(false, [], ["ecommerce"]), ["ecommerce"]);
  });
  test("staff see nothing extra while the room's client hasn't loaded or has no modules", () => {
    assert.deepEqual(clientRoomModuleKeys(false, [], undefined), []);
    assert.deepEqual(clientRoomModuleKeys(false, [], []), []);
  });
  test("a cliente session uses its own session modules, never the room lookup", () => {
    assert.deepEqual(clientRoomModuleKeys(true, ["ecommerce"], undefined), ["ecommerce"]);
    assert.deepEqual(clientRoomModuleKeys(true, [], ["ecommerce"]), []);
  });
});

describe("nextEnabledModules — what a Módulos del Portal switch saves", () => {
  test("turning one on keeps the ones already on", () => {
    assert.deepEqual(nextEnabledModules(["ecommerce"], "autopublicador", true), ["ecommerce", "autopublicador"]);
  });
  test("turning on twice never duplicates", () => {
    assert.deepEqual(nextEnabledModules(["ecommerce"], "ecommerce", true), ["ecommerce"]);
  });
  test("turning one off removes only that one", () => {
    assert.deepEqual(nextEnabledModules(["ecommerce", "seo"], "seo", false), ["ecommerce"]);
  });
});
