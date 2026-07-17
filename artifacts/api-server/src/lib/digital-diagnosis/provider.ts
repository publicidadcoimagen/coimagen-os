import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Which LLM provider powers the Digital Diagnosis Agent. Switching providers
// later (e.g. to Anthropic) is meant to be an env var change, not a rewrite:
// add the new case below with its own createXxx(...) call.
const AI_PROVIDER = process.env.AI_PROVIDER ?? "google";

export function getDigitalDiagnosisModel(): LanguageModel {
  switch (AI_PROVIDER) {
    case "google": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");
      const google = createGoogleGenerativeAI({ apiKey });
      // "gemini-flash-latest" is a Google-maintained alias that always points
      // at their current recommended free-tier flash model, so this doesn't
      // go stale the way a dated model name (e.g. "gemini-2.5-flash") does.
      const modelName = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
      return google(modelName);
    }
    default:
      throw new Error(`AI_PROVIDER "${AI_PROVIDER}" no está soportado todavía`);
  }
}
