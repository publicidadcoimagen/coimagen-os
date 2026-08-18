// Shared status labels/colors for Mundos — used by both the list page and
// the detail page so the two never drift apart. mundos.status is free text
// in the database (no enum constraint at the schema level), validated as
// one of these 5 values only at the API layer (Zod, via the OpenAPI spec).
export const MUNDO_STATUS_LABELS: Record<string, string> = {
  designed: "Diseñado",
  configuring: "En configuración",
  pilot: "Piloto",
  active: "Activo",
  paused: "Pausado",
};

export const MUNDO_STATUS_COLORS: Record<string, string> = {
  designed: "bg-muted text-muted-foreground border-border",
  configuring: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  pilot: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  active: "bg-green-400/15 text-green-400 border-green-400/30",
  paused: "bg-orange-400/15 text-orange-400 border-orange-400/30",
};

export function mundoStatusLabel(status: string): string {
  return MUNDO_STATUS_LABELS[status] ?? status;
}
