import { Link } from "wouter";
import {
  useListOrchestrationEvents, getListOrchestrationEventsQueryKey,
  useListOrchestrationRules, getListOrchestrationRulesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu, Activity, CheckCircle2, XCircle, Clock,
  ArrowRight, GitBranch, BookOpen, BarChart3, ChevronRight,
  Zap, AlertTriangle, PlayCircle,
} from "lucide-react";
import {
  EVENT_CATALOG, SOURCE_LABELS, PRIORITY_META, STATUS_META, getEventLabel,
} from "./catalog";

type OEvent = {
  id: number; eventType: string; source: string; priority: string;
  status: string; clientId?: number | null; createdAt: string;
};
type ORule = { id: number; name: string; triggerEvent: string; status: string; executionCount: number };

const FUTURE_INTEGRATIONS = [
  "n8n", "Gmail", "Google Calendar", "WhatsApp", "Google Drive", "Analytics", "Search Console",
];

export function OrchestrationHub() {
  const { data: rawEvents = [] } = useListOrchestrationEvents(
    {}, { query: { queryKey: getListOrchestrationEventsQueryKey({}) } },
  );
  const { data: rawRules = [] } = useListOrchestrationRules(
    {}, { query: { queryKey: getListOrchestrationRulesQueryKey({}) } },
  );

  const events = rawEvents as OEvent[];
  const rules  = rawRules  as ORule[];

  const byStatus = (s: string) => events.filter((e) => e.status === s).length;
  const activeRules = rules.filter((r) => r.status === "active").length;

  // Events by source
  const bySource = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      acc[e.source] = (acc[e.source] ?? 0) + 1; return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Events by priority
  const byPriority = ["critical", "high", "normal", "low"].map((p) => ({
    p, count: events.filter((e) => e.priority === p).length,
  }));

  const recent = events.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cpu className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orchestration Engine</h1>
            <p className="text-sm text-muted-foreground">El cerebro de COIMAGEN OS — {events.length} eventos · {rules.length} reglas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orchestration/timeline"><Activity className="h-3.5 w-3.5 mr-1.5" />Timeline</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/orchestration/events"><PlayCircle className="h-3.5 w-3.5 mr-1.5" />Monitor</Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Eventos",  value: events.length,       icon: Activity,     color: "text-primary" },
          { label: "Completados",    value: byStatus("completed"),icon: CheckCircle2, color: "text-green-400" },
          { label: "Fallidos",       value: byStatus("failed"),   icon: XCircle,      color: "text-red-400" },
          { label: "Pendientes",     value: byStatus("pending"),  icon: Clock,        color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <div className="flex items-end justify-between mt-1">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <Icon className={`h-6 w-6 ${color} opacity-30`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent events */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Eventos recientes</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
              <Link href="/orchestration/events">Ver todos <ChevronRight className="h-3 w-3" /></Link>
            </Button>
          </div>
          {recent.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-20" />
                <p className="text-sm">Sin eventos registrados</p>
                <Button size="sm" variant="outline" asChild><Link href="/orchestration/events">Registrar primer evento</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {recent.map((e) => {
                const sm = STATUS_META[e.status] ?? STATUS_META["pending"];
                const pm = PRIORITY_META[e.priority] ?? PRIORITY_META["normal"];
                return (
                  <Card key={e.id} className="border-border/40">
                    <CardContent className="p-2.5 flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        e.status === "completed" ? "bg-green-400" :
                        e.status === "failed"    ? "bg-red-400" :
                        e.status === "active"    ? "bg-blue-400" : "bg-yellow-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{getEventLabel(e.eventType)}</p>
                        <p className="text-[10px] text-muted-foreground">{SOURCE_LABELS[e.source] ?? e.source}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] py-0 flex-shrink-0 ${sm.color}`}>{sm.label}</Badge>
                      <Badge variant="outline" className={`text-[9px] py-0 flex-shrink-0 ${pm.color}`}>{pm.label}</Badge>
                      <span className="text-[9px] text-muted-foreground flex-shrink-0 hidden md:block">
                        {new Date(e.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar panels */}
        <div className="space-y-4">
          {/* Rule Engine */}
          <Card className="border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-primary" />Rule Engine
                <Badge variant="outline" className="ml-auto text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30">{activeRules} activas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {rules.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${r.status === "active" ? "bg-green-400" : "bg-muted"}`} />
                  <p className="text-xs truncate flex-1">{r.name}</p>
                  <span className="text-[9px] text-muted-foreground">{r.executionCount}x</span>
                </div>
              ))}
              {rules.length === 0 && <p className="text-[11px] text-muted-foreground">Sin reglas configuradas</p>}
              <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2" asChild>
                <Link href="/orchestration/rules"><ArrowRight className="h-3 w-3 mr-1" />Gestionar reglas</Link>
              </Button>
            </CardContent>
          </Card>

          {/* By source */}
          <Card className="border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-primary" />Por módulo</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {bySource.length === 0 && <p className="text-[11px] text-muted-foreground">Sin datos</p>}
              {bySource.map(([source, count]) => {
                const max = bySource[0]?.[1] ?? 1;
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[10px] text-muted-foreground">{SOURCE_LABELS[source] ?? source}</p>
                      <p className="text-[10px] font-semibold">{count}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* By priority */}
          <Card className="border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-primary" />Por prioridad</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {byPriority.map(({ p, count }) => {
                const pm = PRIORITY_META[p]!;
                return (
                  <div key={p} className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[9px] py-0 ${pm.color}`}>{pm.label}</Badge>
                    <span className="text-xs font-semibold">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Future integrations */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5" />Integraciones futuras
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {FUTURE_INTEGRATIONS.map((name) => (
            <Badge key={name} variant="outline" className="text-[10px] py-0.5 bg-muted/30 text-muted-foreground/60 border-border/40">{name}</Badge>
          ))}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: "/orchestration/events",  label: "Event Monitor",  icon: Activity,  desc: "Ver y gestionar eventos" },
          { href: "/orchestration/rules",   label: "Rule Engine",    icon: GitBranch, desc: "Configurar reglas" },
          { href: "/orchestration/timeline",label: "Timeline Global",icon: Clock,     desc: "Historial cronológico" },
          { href: "/orchestration/catalog", label: "Catálogo",       icon: BookOpen,  desc: "Tipos de eventos" },
        ].map(({ href, label, icon: Icon, desc }) => (
          <Link key={href} href={href}>
            <Card className="border-border/40 hover:border-primary/30 transition-all cursor-pointer h-full">
              <CardContent className="p-3">
                <Icon className="h-5 w-5 text-primary/60 mb-2" />
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
