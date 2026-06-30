import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight } from "lucide-react";
import { EVENT_CATALOG, SOURCE_LABELS, PRIORITY_META } from "./catalog";

const FUTURE_INTEGRATIONS = [
  { name: "n8n",            desc: "Automatización de workflows sin código",         status: "planned" },
  { name: "Gmail",          desc: "Envío de emails, notificaciones y seguimientos", status: "planned" },
  { name: "Google Calendar",desc: "Sincronización de reuniones y vencimientos",     status: "planned" },
  { name: "WhatsApp",       desc: "Mensajes y notificaciones directas al cliente",  status: "planned" },
  { name: "Google Drive",   desc: "Almacenamiento y acceso a documentos",          status: "planned" },
  { name: "Analytics",      desc: "Métricas de tráfico y comportamiento",          status: "planned" },
  { name: "Search Console", desc: "Monitoreo de posicionamiento y SEO",            status: "planned" },
];

const SOURCE_GROUPS = Array.from(
  new Set(EVENT_CATALOG.map((e) => e.source)),
).map((source) => ({
  source,
  events: EVENT_CATALOG.filter((e) => e.source === source),
}));

export function EventCatalogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Catálogo de Eventos</h1>
          <p className="text-sm text-muted-foreground">{EVENT_CATALOG.length} tipos de eventos · {SOURCE_GROUPS.length} módulos</p>
        </div>
      </div>

      {/* Event types by source */}
      <div className="space-y-6">
        {SOURCE_GROUPS.map(({ source, events }) => (
          <div key={source}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              {SOURCE_LABELS[source] ?? source}
            </p>
            <div className="space-y-2">
              {events.map((event) => {
                const pm = PRIORITY_META[event.priority]!;
                return (
                  <Card key={event.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-bold">{event.label}</p>
                            <Badge variant="outline" className={`text-[9px] py-0 ${pm.color}`}>{pm.label}</Badge>
                            <code className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">{event.id}</code>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{event.description}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wide mr-1">Acciones sugeridas:</span>
                            {event.suggestedActions.map((a) => (
                              <div key={a} className="flex items-center gap-0.5">
                                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
                                <span className="text-[10px] text-muted-foreground">{a}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Future integrations */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Integraciones futuras</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {FUTURE_INTEGRATIONS.map((int) => (
            <Card key={int.name} className="border-border/40 opacity-60">
              <CardContent className="p-3 flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{int.name}</p>
                    <Badge variant="outline" className="text-[9px] py-0 bg-amber-400/10 text-amber-400 border-amber-400/30">Planificado</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{int.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
