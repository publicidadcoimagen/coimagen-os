import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { APICallError } from "ai";
import { isInsufficientCreditError } from "../src/lib/digital-diagnosis/analyze";

// isInsufficientCreditError is the single condition that decides whether the
// Digital Diagnosis Agent falls back from Anthropic to Gemini (see
// analyze.ts). It must fire for Anthropic's dedicated 402 billing_error and
// for nothing else — a false positive here would silently mask real bugs
// (bad API key, malformed request, rate limiting) behind Gemini forever.

function apiCallError(statusCode?: number): APICallError {
  return new APICallError({
    message: "test error",
    url: "https://api.anthropic.com/v1/messages",
    requestBodyValues: {},
    statusCode,
  });
}

describe("isInsufficientCreditError", () => {
  test("true for HTTP 402 (Anthropic's billing_error)", () => {
    assert.equal(isInsufficientCreditError(apiCallError(402)), true);
  });

  test("false for 400 invalid_request_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(400)), false);
  });

  test("false for 401 authentication_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(401)), false);
  });

  test("false for 403 permission_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(403)), false);
  });

  test("false for 429 rate_limit_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(429)), false);
  });

  test("false for 500 api_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(500)), false);
  });

  test("false for 529 overloaded_error", () => {
    assert.equal(isInsufficientCreditError(apiCallError(529)), false);
  });

  test("false when statusCode is missing", () => {
    assert.equal(isInsufficientCreditError(apiCallError(undefined)), false);
  });

  test("false for a plain Error (not an APICallError)", () => {
    assert.equal(isInsufficientCreditError(new Error("network down")), false);
  });

  test("false for a non-Error thrown value", () => {
    assert.equal(isInsufficientCreditError("boom"), false);
  });
});
