import { generateText } from "ai";
import { getDeepSeekModel } from "./provider";

export interface CaptionRequest {
  topic: string;
  networks: string[];
  tone?: string;
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
export async function generateCaption(request: CaptionRequest): Promise<string> {
  const { text } = await generateText({
    model: getDeepSeekModel(),
    prompt: buildCaptionPrompt(request),
  });
  return text.trim();
}
