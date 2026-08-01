import { generateText } from "ai";
import { getDeepSeekModel } from "./provider";
import { db, contentCalendarItemsTable, contentCalendarTargetsTable } from "@workspace/db";

export interface CaptionRequest {
  topic: string;
  networks: string[];
  tone?: string;
}

export interface CaptionUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  // Approximate — computed from a hardcoded price table, not billed truth.
  // Only deepseek-v4-flash's published rate is known today; other models
  // fall back to that same rate rather than silently reporting $0.
  costUsd: number;
}

export interface CaptionResult {
  caption: string;
  usage: CaptionUsage;
}

// https://api-docs.deepseek.com/quick_start/pricing — cache-miss input rate
// (no prompt caching in play for one-off caption generation), checked 2026-08-01.
// DeepSeek has announced upcoming peak/off-peak 2x pricing with no effective
// date yet — revisit this constant once that lands.
const DEEPSEEK_V4_FLASH_PRICE_PER_1M = { input: 0.14, output: 0.28 };

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * DEEPSEEK_V4_FLASH_PRICE_PER_1M.input +
    (outputTokens / 1_000_000) * DEEPSEEK_V4_FLASH_PRICE_PER_1M.output
  );
}

export function buildCaptionPrompt({ topic, networks, tone }: CaptionRequest): string {
  return `Eres un community manager escribiendo un copy para redes sociales, en español, para publicar en: ${networks.join(", ")}.

Tema/brief de la publicación: ${topic}

Tono: ${tone ?? "cercano y profesional"}.

Reglas:
- Máximo 3 líneas de texto principal.
- Incluye hasta 5 hashtags relevantes al final.
- No inventes datos concretos (precios, horarios, direcciones) que no estén en el brief — si el brief no los da, no los pongas.
- Responde solo con el copy final, sin explicaciones ni comillas envolventes.`;
}

// Text-only for now — media generation (imagen/video) es una fase posterior.
export async function generateCaption(request: CaptionRequest): Promise<CaptionResult> {
  const { text, usage } = await generateText({
    model: getDeepSeekModel(),
    prompt: buildCaptionPrompt(request),
  });
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return {
    caption: text.trim(),
    usage: {
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(inputTokens, outputTokens),
    },
  };
}

export interface GenerateDraftRequest extends CaptionRequest {
  clientId: number;
  createdBy?: string;
}

// Generates a caption and creates its draft + targets in one step, with the
// generation usage/cost persisted on the item — the only place today where
// generateCaption()'s output actually becomes a content_calendar_items row
// (POST /items still takes plain caption text for manually-written drafts).
export async function generateCaptionAndCreateDraft(request: GenerateDraftRequest) {
  const { clientId, createdBy, ...captionRequest } = request;
  const { caption, usage } = await generateCaption(captionRequest);

  const [item] = await db.insert(contentCalendarItemsTable).values({
    clientId,
    caption,
    createdBy: createdBy ?? null,
    status: "draft",
    generationModel: usage.model,
    generationInputTokens: usage.inputTokens,
    generationOutputTokens: usage.outputTokens,
    generationCostUsd: usage.costUsd.toFixed(8),
  }).returning();

  const targets = await db.insert(contentCalendarTargetsTable).values(
    captionRequest.networks.map((network) => ({
      calendarItemId: item!.id,
      network,
      status: "pending",
    })),
  ).returning();

  return { item: item!, targets, usage };
}
