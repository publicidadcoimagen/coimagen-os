import { generateObject, APICallError } from "ai";
import { getAnthropicModel, getGeminiModel } from "./provider";
import { digitalDiagnosisAnalysisSchema, type DigitalDiagnosisAnalysis } from "./analysis-schema";
import type { ScrapedSignals } from "./scrape";
import { logger } from "../logger";

export type DigitalDiagnosisProvider = "anthropic" | "google";

export interface DigitalDiagnosisGeneration {
  analysis: DigitalDiagnosisAnalysis;
  provider: DigitalDiagnosisProvider;
}

// The only condition that triggers the Gemini fallback: Anthropic's account
// has no credit loaded. Anthropic returns this as a dedicated HTTP 402
// billing_error — not a message-text match, not folded into the generic
// 400 invalid_request_error bucket. Any other error (auth, rate limit,
// network, 5xx, or a 400 for an actually malformed request) must NOT be
// caught here — it propagates to the caller, which is what drives the
// existing incident-on-error path in public-digital-diagnosis.ts. Silently
// falling back on any error would hide real bugs (a bad API key, a broken
// prompt) behind Gemini forever instead of surfacing them.
export function isInsufficientCreditError(err: unknown): boolean {
  return APICallError.isInstance(err) && err.statusCode === 402;
}

// Below this word count, the page's real content is more likely hidden
// behind client-side JS rendering (a React/Vue/etc SPA) than genuinely empty
// — our scraper only reads the raw HTML response, before any JS runs.
const LOW_CONTENT_THRESHOLD = 50;

function buildPrompt(url: string, signals: ScrapedSignals): string {
  const possibleJsRenderedSite = signals.wordCount < LOW_CONTENT_THRESHOLD;
  const lowContentNote = possibleJsRenderedSite
    ? `\nNOTA IMPORTANTE: el análisis técnico solo leyó el HTML crudo de la página, sin ejecutar JavaScript. Con ${signals.wordCount} palabras detectadas, es muy probable que este sitio use un framework de renderizado del lado del cliente (React, Vue, Angular, etc.) cuyo contenido real no es visible en el HTML inicial — NO asumas que el sitio "no tiene contenido" o está vacío para un visitante humano. En los campos de "issues" y "readabilityNotes" relacionados a contenido, indica explícitamente esta incertidumbre (ej. "no pudimos verificar el contenido visible automáticamente, posible sitio con renderizado dinámico — se recomienda revisión manual") en vez de afirmar que el contenido no existe. Esto sí es un hallazgo real y accionable en sí mismo: si los buscadores tampoco ejecutan JavaScript al indexar, el sitio puede tener un problema real de SEO por esta misma razón — puedes mencionarlo como tarea prioritaria.\n`
    : "";

  return `Eres un consultor de marketing digital analizando el sitio web de un negocio para generar un diagnóstico gratuito, en español, con un formato similar a un reporte tipo Seobility (meta info, calidad de contenido, estructura, enlaces, factores generales, y tareas priorizadas).

URL analizada: ${url}
${lowContentNote}

Datos técnicos extraídos directamente del HTML (úsalos tal cual, no los reinventes):
- Título (<title>): ${signals.title ?? "(sin título)"} — ${signals.titleLength} caracteres
- Meta descripción: ${signals.metaDescription ?? "(sin meta descripción)"} — ${signals.metaDescriptionLength} caracteres
- Tiene meta viewport (responsive): ${signals.hasViewportMeta}
- Idioma declarado (atributo lang): ${signals.language ?? "(no declarado)"}
- Usa HTTPS: ${signals.hasSsl}
- Cantidad de encabezados <h1>: ${signals.h1Count}
- Cantidad aproximada de palabras en el contenido visible: ${signals.wordCount}
- Enlaces internos detectados: ${signals.internalLinksCount}
- Enlaces externos detectados: ${signals.externalLinksCount}

Texto visible extraído de la página (muestra, puede estar truncado):
"""
${signals.textSample || "(no se pudo extraer texto visible)"}
"""

Con base en estos datos, genera el diagnóstico estructurado. Usa los números técnicos exactos que te di arriba para los campos que los piden (no los inventes ni los cambies). Para los campos cualitativos (issues, readabilityNotes, prioritizedTasks, summary), analiza con criterio de negocio real: qué le falta a este sitio para generar más contactos/ventas. La lista de "prioritizedTasks" debe tener entre 3 y 6 tareas concretas y accionables, ordenadas por impacto. El "summary" debe ser 2-3 oraciones en español, directas, sin relleno.`;
}

export async function generateDigitalDiagnosis(url: string, signals: ScrapedSignals): Promise<DigitalDiagnosisGeneration> {
  const schema = digitalDiagnosisAnalysisSchema;
  const prompt = buildPrompt(url, signals);

  try {
    const { object } = await generateObject({ model: getAnthropicModel(), schema, prompt });
    return { analysis: object, provider: "anthropic" };
  } catch (err) {
    if (!isInsufficientCreditError(err)) throw err;
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Anthropic sin crédito disponible (402) — usando Gemini como fallback para el Digital Diagnosis Agent",
    );
    const { object } = await generateObject({ model: getGeminiModel(), schema, prompt });
    return { analysis: object, provider: "google" };
  }
}
