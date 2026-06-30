export const CATEGORIES = [
  "Marketing", "SEO", "Ventas", "Clientes", "Producción",
  "Finanzas", "Administración", "Cloud", "Automatización", "CEO",
] as const;

export type AgentCategory = typeof CATEGORIES[number];

export const AI_MODELS = [
  { id: "chatgpt",   name: "ChatGPT",             provider: "OpenAI" },
  { id: "claude",    name: "Claude",               provider: "Anthropic" },
  { id: "gemini",    name: "Gemini",               provider: "Google" },
  { id: "perplexity",name: "Perplexity",           provider: "Perplexity" },
  { id: "grok",      name: "Grok",                 provider: "xAI" },
  { id: "deepseek",  name: "DeepSeek",             provider: "DeepSeek" },
  { id: "openrouter",name: "OpenRouter",           provider: "OpenRouter" },
  { id: "custom",    name: "Modelo personalizado", provider: "Custom" },
] as const;

export const TOOLS_CATALOG = [
  { id: "openai",         name: "OpenAI",          emoji: "🤖", group: "IA" },
  { id: "anthropic",      name: "Anthropic",       emoji: "🧠", group: "IA" },
  { id: "google-ai",      name: "Google AI",       emoji: "🔮", group: "IA" },
  { id: "n8n",            name: "n8n",             emoji: "⚡", group: "Automatización" },
  { id: "replit",         name: "Replit",          emoji: "🛠", group: "Desarrollo" },
  { id: "github",         name: "GitHub",          emoji: "🐙", group: "Desarrollo" },
  { id: "jotform",        name: "Jotform",         emoji: "📋", group: "Formularios" },
  { id: "whatsapp",       name: "WhatsApp",        emoji: "💬", group: "Mensajería" },
  { id: "google-drive",   name: "Google Drive",    emoji: "📁", group: "Productividad" },
  { id: "gmail",          name: "Gmail",           emoji: "📧", group: "Productividad" },
  { id: "calendar",       name: "Calendar",        emoji: "📅", group: "Productividad" },
  { id: "search-console", name: "Search Console",  emoji: "🔍", group: "Analytics" },
  { id: "analytics",      name: "Analytics",       emoji: "📊", group: "Analytics" },
  { id: "facebook",       name: "Facebook",        emoji: "👥", group: "Social" },
  { id: "instagram",      name: "Instagram",       emoji: "📸", group: "Social" },
  { id: "tiktok",         name: "TikTok",          emoji: "🎵", group: "Social" },
  { id: "linkedin",       name: "LinkedIn",        emoji: "💼", group: "Social" },
  { id: "youtube",        name: "YouTube",         emoji: "🎥", group: "Social" },
] as const;

export type ToolId = typeof TOOLS_CATALOG[number]["id"];

export const PRIORITY_CONFIG = {
  low:      { label: "Baja",     color: "text-muted-foreground", dot: "bg-muted-foreground" },
  medium:   { label: "Media",    color: "text-yellow-400",       dot: "bg-yellow-400" },
  high:     { label: "Alta",     color: "text-orange-400",       dot: "bg-orange-400" },
  critical: { label: "Crítica",  color: "text-red-500",          dot: "bg-red-500" },
} as const;

export const STATUS_CONFIG = {
  active:   { label: "Activo",   class: "bg-green-400/15 text-green-400 border-green-400/30" },
  paused:   { label: "Pausado",  class: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  inactive: { label: "Inactivo", class: "bg-muted text-muted-foreground border-border" },
} as const;

export const CATEGORY_COLOR: Record<string, string> = {
  Marketing:       "bg-pink-400/15 text-pink-400",
  SEO:             "bg-purple-400/15 text-purple-400",
  Ventas:          "bg-green-400/15 text-green-400",
  Clientes:        "bg-blue-400/15 text-blue-400",
  Producción:      "bg-orange-400/15 text-orange-400",
  Finanzas:        "bg-emerald-400/15 text-emerald-400",
  Administración:  "bg-slate-400/15 text-slate-400",
  Cloud:           "bg-cyan-400/15 text-cyan-400",
  Automatización:  "bg-secondary/15 text-secondary",
  CEO:             "bg-primary/15 text-primary",
};
