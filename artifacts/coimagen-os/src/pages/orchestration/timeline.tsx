import {
  useListOrchestrationEvents, getListOrchestrationEventsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { SOURCE_LABELS, PRIORITY_META, STATUS_META, getEventLabel } from "./catalog";

type OEvent = {
  id: number; eventType: string; source: string; destination?: string | null;
  priority: string; status: string; clientId?: number | null; projectId?: number | null;
  notes?: string | null; createdAt: string;
};

function groupByDate(events: OEvent[]): Array<{ date: string; events: OEvent[] }> {
  const groups: Record<string, OEvent[]> = {};
  events.forEach((e) => {
    const day = new Date(e.createdAt).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  });
  return Object.entries(groups).map(([date, events]) => ({ date, events }));
}

export function GlobalTimeline() {
  const { data: rawEvents = [], isLoading } = useListOrchestrationEvents(
    {}, { query: { queryKey: getListOrchestrationEventsQueryKey({}) } },
  );
  const events = rawEvents as OEvent[];
  const groups = groupByDate(events);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Timeline Global</h1>
          <p className="text-sm text-muted-foreground">Todo lo que ocurre en COIMAGEN OS — {events.length} eventos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-20" /></Card>)}</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <Activity className="h-12 w-12 opacity-20" />
          <p className="text-sm">El timeline está vacío</p>
          <p className="text-[11px]">Los eventos se registrarán aquí automáticamente</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ date, events: dayEvents }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border/40" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 capitalize">{date}</p>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="space-y-0">
                {dayEvents.map((e, i) => {
                  const sm = STATUS_META[e.status] ?? STATUS_META["pending"];
                  const pm = PRIORITY_META[e.priority] ?? PRIORITY_META["normal"];
                  const isLast = i === dayEvents.length - 1;
                  const Icon = e.status === "completed" ? CheckCircle2 : e.status === "failed" ? XCircle : e.status === "active" ? Zap : Clock;
                  const dotColor = e.status === "completed" ? "bg-green-400 border-green-400" : e.status === "failed" ? "bg-red-400 border-red-400" : e.status === "active" ? "bg-blue-400 border-blue-400" : "bg-yellow-400 border-yellow-400";

                  return (
                    <div key={e.id} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 24 }}>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${dotColor}`}>
                          <Icon className="h-2.5 w-2.5 text-white" />
                        </div>
                        {!isLast && <div className="w-0.5 flex-1 bg-border/40 my-0.5" style={{ minHeight: 12 }} />}
                      </div>

                      {/* Event content */}
                      <div className={`flex-1 min-w-0 ${!isLast ? "pb-3" : "pb-1"}`}>
                        <Card className="border-border/40 hover:border-primary/20 transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold flex-1">{getEventLabel(e.eventType)}</p>
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                {new Date(e.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">{SOURCE_LABELS[e.source] ?? e.source}</span>
                              {e.destination && <><span className="text-[10px] text-muted-foreground">→</span><span className="text-[10px] text-muted-foreground">{e.destination}</span></>}
                              <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
                              <Badge variant="outline" className={`text-[9px] py-0 ${pm.color}`}>{pm.label}</Badge>
                              {e.clientId && <Badge variant="outline" className="text-[9px] py-0">Cliente #{e.clientId}</Badge>}
                            </div>
                            {e.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{e.notes}</p>}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
