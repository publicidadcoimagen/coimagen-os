import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getEnvironment } from "../src/routes/health";

describe("getEnvironment", () => {
  test("reports production when Render's own RENDER flag is set, regardless of NODE_ENV", () => {
    assert.equal(getEnvironment({ RENDER: "true" }), "production");
    assert.equal(getEnvironment({ RENDER: "true", NODE_ENV: "development" }), "production");
  });

  test("reports production when NODE_ENV is production even off Render", () => {
    assert.equal(getEnvironment({ NODE_ENV: "production" }), "production");
  });

  test("reports development when neither signal is present", () => {
    assert.equal(getEnvironment({}), "development");
    assert.equal(getEnvironment({ NODE_ENV: "development" }), "development");
  });
});
