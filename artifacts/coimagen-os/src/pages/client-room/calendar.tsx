import { useRoute } from "wouter";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Receipt, Construction } from "lucide-react";

const UPCOMING = [
  { date: "2026-07-05", type: "reunion", label: "Reunión de seguimiento semanal", tag: "Reunión" },
  { date: "2026-07-10", type: "entrega", label: "Entrega de diseños v2", tag: "Entrega" },
  { date: "2026-07-15", type: "pago", label: "Vencimiento mensualidad julio", tag: "Factura" },
  { date: "2026-07-20", type: "reunion", label: "Presentación de resultados del mes", tag: "Reunión" },
  { date: "2026-08-01", type: "vencimiento", label: "Revisión de contrato anual", tag: "Contrato" },
];

const TAG_COLOR: Record<string, string> = {
  "Reunión":  "bg-blue-400/15 text-blue-400 border-blue-400/30",
  "Entrega":  "bg-green-400/15 text-green-400 border-green-400/30",
  "Factura":  "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  "Contrato": "bg-purple-400/15 text-purple-400 border-purple-400/30",
};

const TAG_ICON: Record<string, React.ComponentType<{className?: string}>> = {
  "Reunión":  Clock,
  "Entrega":  FileText,
  "Factura":  Receipt,
  "Contrato": FileText,
};

export function ClientCalendar() {
  const [, params] = useRoute("/client/:slug/calendar");
  const slug = params?.slug ?? "";

  const today = new Date();

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Calendario</h1>
            <p className="text-sm text-muted-foreground">Reuniones, entregas y vencimientos</p>
          </div>
        </div>

        <Card className="border-amber-400/20 bg-amber-400/5">
          <CardContent className="p-3 flex items-start gap-2">
            <Construction className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              El calendario integrado estará disponible próximamente. A continuación se muestran eventos de ejemplo.
            </p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Próximos eventos</h2>
          <div className="space-y-2">
            {UPCOMING.map((event, i) => {
              const Icon = TAG_ICON[event.tag] ?? Clock;
              const eventDate = new Date(event.date);
              const isPast = eventDate < today;
              return (
                <Card key={i} className={`border-border/50 ${isPast ? "opacity-50" : ""}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="text-center flex-shrink-0 w-10">
                      <p className="text-[9px] text-muted-foreground uppercase">
                        {eventDate.toLocaleDateString("es-MX", { month: "short" })}
                      </p>
                      <p className="text-xl font-bold leading-tight">{eventDate.getDate()}</p>
                    </div>
                    <div className="w-px h-8 bg-border/60 flex-shrink-0" />
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {eventDate.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] py-0 flex-shrink-0 ${TAG_COLOR[event.tag] ?? ""}`}>{event.tag}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </ClientRoomLayout>
  );
}
