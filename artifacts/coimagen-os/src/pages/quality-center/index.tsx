import { Link } from "wouter";
import { useListIncidents, getListIncidentsQueryKey, useListQcTickets, getListQcTicketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Bug, Code2, TestTube2, Gauge, Lock, Network,
  HeartPulse, ClipboardList, Lightbulb, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Ticket, ChevronRight,
} from "lucide-react";

type Inc = { id: number; status: string; severity: string; type: string; title: string; priority: string; createdAt: string };
type Tkt = { id: number; status: string; priority: string };

const SEVERITY_COLOR: Record<string, string> = {
  low:      "bg-slate-400/15 text-slate-400 border-slate-400/30",
  medium:   "bg-blue-400/15 text-blue-400 border-blue-400/30",
  high:     "bg-orange-400/15 text-orange-400 border-orange-400/30",
  critical: "bg-red-400/15 text-red-400 border-red-400/30",
};

const SUBMODULES = [
  {
    href: "/quality-center/incidents",
    label: "Incident Center",
    description: "Bugs, incidentes, errores y mejoras",
    icon: Bug,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    badge: "live",
  },
  {
    href: "/quality-center/code-review",
    label: "Code Review",
    description: "Auditoría de código y buenas prácticas",
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/qa-testing",
    label: "QA Testing",
    description: "Registro de pruebas UI, backend y e2e",
    icon: TestTube2,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/performance",
    label: "Performance",
    description: "Queries, render, Lighthouse y Core Web Vitals",
    icon: Gauge,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/security",
    label: "Security",
    description: "Roles, permisos, endpoints y secretos",
    icon: Lock,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/architecture",
    label: "Architecture",
    description: "Dependencias, servicios y escalabilidad",
    icon: Network,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/health-check",
    label: "Health Check",
    description: "Estado general del sistema en tiempo real",
    icon: HeartPulse,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    badge: "live",
  },
  {
    href: "/quality-center/technical-debt",
    label: "Technical Debt",
    description: "Pendientes técnicos y refactorización",
    icon: ClipboardList,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
    badge: "prep",
  },
  {
    href: "/quality-center/recommendations",
    label: "Recommendations",
    description: "Recomendaciones de mejora por prioridad",
    icon: Lightbulb,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    badge: "prep",
  },
];

export function QualityCenter() {
  const { data: rawInc = [] } = useListIncidents({}, { query: { queryKey: getListIncidentsQueryKey({}) } });
  const { data: rawTkts = [] } = useListQcTickets({}, { query: { queryKey: getListQcTicketsQueryKey({}) } });

  const incidents = rawInc as Inc[];
  const tickets = rawTkts as Tkt[];

  const kpis = {
    open: incidents.filter((i) => i.status === "open").length,
    resolved: incidents.filter((i) => i.status === "resolved" || i.status === "closed").length,
    critical: incidents.filter((i) => i.severity === "critical").length,
    tickets: tickets.length,
    ticketsOpen: tickets.filter((t) => t.status === "open" || t.status === "assigned").length,
    total: incidents.length,
  };

  const recent = incidents.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quality Center</h1>
            <p className="text-sm text-muted-foreground">Centro de calidad, auditoría y mejora continua</p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/quality-center/incidents">
            <Bug className="h-4 w-4 mr-1.5" />Registrar Incidente
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Abiertos", value: kpis.open, icon: AlertTriangle, color: "text-orange-400" },
          { label: "Resueltos", value: kpis.resolved, icon: CheckCircle2, color: "text-green-400" },
          { label: "Críticos", value: kpis.critical, icon: Bug, color: "text-red-400" },
          { label: "Tickets", value: kpis.tickets, icon: Ticket, color: "text-blue-400" },
          { label: "Tkt. Abiertos", value: kpis.ticketsOpen, icon: Clock, color: "text-yellow-400" },
          { label: "Total", value: kpis.total, icon: TrendingUp, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold">{value}</p>
                <Icon className={`h-5 w-5 ${color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submodules grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUBMODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href}>
                <Card className={`border ${mod.border} hover:border-primary/40 transition-all cursor-pointer group`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg ${mod.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${mod.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold group-hover:text-primary transition-colors">{mod.label}</span>
                          {mod.badge === "live" ? (
                            <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30">LIVE</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 bg-muted/20 text-muted-foreground border-border/30">PREP</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{mod.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent incidents */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Incidentes recientes</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href="/quality-center/incidents">Ver todos</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {recent.map((inc) => (
              <Link key={inc.id} href={`/quality-center/incidents/${inc.id}`}>
                <Card className="border-border/50 hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{inc.title}</span>
                        <Badge variant="outline" className={`text-[10px] py-0 ${SEVERITY_COLOR[inc.severity] ?? ""}`}>{inc.severity}</Badge>
                        <span className="text-[10px] text-muted-foreground">{inc.type}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(inc.createdAt).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${inc.status === "open" ? "bg-orange-400/10 text-orange-400 border-orange-400/30" : inc.status === "resolved" || inc.status === "closed" ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-blue-400/10 text-blue-400 border-blue-400/30"}`}>
                      {inc.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
