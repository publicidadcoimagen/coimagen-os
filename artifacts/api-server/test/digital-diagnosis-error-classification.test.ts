import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { APICallError } from "ai";
import { classifyDigitalDiagnosisError } from "../src/lib/digital-diagnosis/analyze";
import { DigitalDiagnosisScrapeError } from "../src/lib/digital-diagnosis/scrape";

// classifyDigitalDiagnosisError is the single choke point that decides what
// ever reaches ai_executions.errors / incidents.description — a database
// column the AI Execution Engine's /executions/:id detail view (and the
// Quality Center incident view) render straight to the screen. A real
// production incident (execs #28/#29, 2026-07-27) stored and rendered the
// FULL raw APICallError, including requestBodyValues (the Digital Diagnosis
// Agent's entire internal system prompt plus the generated-object tool
// schema sent to Anthropic) and responseHeaders (including Anthropic's
// organization id) — reproduced here verbatim from the real stored row to
// prove this exact shape is now caught.

function realExec28Error(): APICallError {
  // Trimmed from the real ai_executions.errors row #28 (still has the two
  // dangerous properties intact: requestBodyValues and responseHeaders).
  return new APICallError({
    message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    url: "https://api.anthropic.com/v1/messages",
    requestBodyValues: {
      model: "claude-sonnet-5",
      max_tokens: 128000,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: "Eres un consultor de marketing digital analizando el sitio web de un negocio para generar un diagnóstico gratuito...",
        }],
      }],
      tools: [{ name: "digitalDiagnosisAnalysis", input_schema: { type: "object", properties: { summary: { type: "string" } } } }],
    },
    responseHeaders: {
      "anthropic-organization-id": "org-real-secret-id-12345",
      "request-id": "req_abc123",
    },
    statusCode: 400,
    data: { error: { type: "invalid_request_error" } },
  });
}

describe("classifyDigitalDiagnosisError", () => {
  test("never includes requestBodyValues or responseHeaders for the real exec #28/#29 shape", () => {
    const result = classifyDigitalDiagnosisError(realExec28Error());
    assert.doesNotMatch(result, /requestBodyValues/i);
    assert.doesNotMatch(result, /responseHeaders/i);
    assert.doesNotMatch(result, /anthropic-organization-id/i);
    assert.doesNotMatch(result, /consultor de marketing digital/i);
    assert.doesNotMatch(result, /digitalDiagnosisAnalysis/i);
  });

  test("classifies the insufficient-credit case with the safe generic message", () => {
    const err = new APICallError({
      message: "Your credit balance is too low to access the Anthropic API.",
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: { system: "leaked prompt should not appear" },
      statusCode: 402,
    });
    assert.equal(classifyDigitalDiagnosisError(err), "Crédito insuficiente en el proveedor de IA.");
  });

  test("keeps a DigitalDiagnosisScrapeError's message as-is (already vetted user-safe text)", () => {
    const err = new DigitalDiagnosisScrapeError("No pudimos acceder a ese sitio. Verifica el dominio.");
    assert.equal(classifyDigitalDiagnosisError(err), "No pudimos acceder a ese sitio. Verifica el dominio.");
  });

  test("classifies an unclassified APICallError by status code only, no request/response detail", () => {
    const err = new APICallError({
      message: "Internal server error",
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: { system: "leaked prompt should not appear" },
      responseHeaders: { "anthropic-organization-id": "org-secret" },
      statusCode: 500,
    });
    const result = classifyDigitalDiagnosisError(err);
    assert.equal(result, "Error del proveedor de IA (HTTP 500).");
  });

  test("falls back to a fully generic message for a plain unclassified Error", () => {
    assert.equal(
      classifyDigitalDiagnosisError(new Error("some DB error with a connection string inside")),
      "Error interno inesperado. Ver logs del servidor para más detalle.",
    );
  });
});
