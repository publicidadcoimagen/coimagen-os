import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";

// Text generation for Autopublicador Social. DeepSeek was chosen over
// Anthropic/Gemini for this specific task because caption copy is low-risk
// and cost-per-volume matters more than max quality here — not a stand-in
// for the digital-diagnosis provider pattern in general.

export function getDeepSeekModel(): LanguageModel {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY no está configurada");
  const deepseek = createDeepSeek({ apiKey });
  // "deepseek-chat"/"deepseek-reasoner" stopped responding 2026-07-24 —
  // DeepSeek renamed its lineup to "deepseek-v4-flash"/"deepseek-v4-pro".
  const modelName = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  return deepseek(modelName);
}
