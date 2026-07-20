import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// The Digital Diagnosis Agent tries Anthropic first and falls back to
// Gemini only when Anthropic has no credit loaded (see analyze.ts'
// isInsufficientCreditError) — not an either/or provider switch, so both
// getters below are used together, not selected via an env var.

export function getAnthropicModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada");
  const anthropic = createAnthropic({ apiKey });
  const modelName = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  return anthropic(modelName);
}

export function getGeminiModel(): LanguageModel {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");
  const google = createGoogleGenerativeAI({ apiKey });
  // "gemini-flash-latest" is a Google-maintained alias that always points
  // at their current recommended free-tier flash model, so this doesn't
  // go stale the way a dated model name (e.g. "gemini-2.5-flash") does.
  const modelName = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  return google(modelName);
}
