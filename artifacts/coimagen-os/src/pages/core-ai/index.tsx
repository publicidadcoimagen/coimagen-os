import { useState } from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRevenueSummary, getGetRevenueSummaryQueryKey,
  useListAgents, getListAgentsQueryKey,
  useListWorkflows, getListWorkflowsQueryKey,
  useListInvoices, getListInvoicesQueryKey,
  useListContracts, getListContractsQueryKey,
  useListOrchestrationEvents, getListOrchestrationEventsQueryKey,
  useListProspects, getListProspectsQueryKey,
  useListAutomations, getListAutomationsQueryKey,
  useListIncidents, getListIncidentsQueryKey,
  useListQcTickets, getListQcTicketsQueryKey,
  useListIntegrations, getListIntegrationsQueryKey,
  useListAiExecutions, getListAiExecutionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Users, FolderKanban, CheckSquare, FileText,
  Receipt, AlertTriangle, Bot, Activity, Zap, TrendingUp,
  Shield, GitBranch, User, Clock, CircleCheck, CircleX,
  CircleAlert, ArrowRight, Cpu, BookOpen, Target, Sparkles,
  BarChart3, DollarSign, Calendar, Bell, PlayCircle, RefreshCw,
  Wifi, WifiOff, ChevronRight, Plug,
} from "lucide-react";
import { Link } from "wouter";
import { getEventLabel, SOURCE_LABELS } from "@/pages/orchestration/catalog";

type DashSummary = {
  totalClients: number; activeClients: number; suspendedClients: number;
  activeProjects: number; openTasks: number; overdueTasks: number;
  completedProjectsThisMonth: number; totalAgents: number;
  activeClientsThisMonth: number; pendingApprovals: number;
  mrr: number; arr: number; totalCostsThisMonth: number;
  marginThisMonth: number; overdueInvoices: number; upcomingPayments: number;
};
type RevSummary = { mrr: number; arr: number; highTicketCount: number; highTicketTotal: number };
type Agent = { id: number; name: string; status: string };
type Workflow = { id: number; name: string; status?: string | null; currentStage?: string | null };
type Invoice = { id: number; status: string; totalAmount?: number | null; clientName?: string | null };
type Contract = { id: number; status?: string | null; title?: string | null };
type Prospect = { id: number; status?: string | null };
type Automation = { id: number; status?: string | null; errors?: string | null; totalExecutions?: number | null; executionsToday?: number | null };
type AiExec = { id: number; status: string; result: string; isSimulated: boolean; sentToQc: boolean; errors?: string | null };
type Incident = { id: number; status?: string | null; severity?: string | null; title: string };
type QcTicket = { id: number; status?: string | null; priority?: string | null; title: string };
type OEvent = { id: number; eventType: string; source: string; status: string; createdAt: string };
type Integ = { id: number; status: string };

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("es-MX")}`;
}

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

type ModuleHealth = "ok" | "warning" | "error" | "unknown";
function HealthDot({ health }: { health: ModuleHealth }) {
  const c = health === "ok" ? "bg-green-400" : health === "warning" ? "bg-yellow-400" : health === "error" ? "bg-red-400" : "bg-muted";
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${c}`} />;
}

type Priority = { label: string; detail: string; href: string; level: "critical" | "high" | "medium" };

function ReviewDialog({ open, onClose, summary, agents, workflows, incidents, qcTickets, events }: {
  open: boolean; onClose: () => void;
  summary: DashSummary | undefined;
  agents: Agent[]; workflows: Workflow[];
  incidents: Incident[]; qcTickets: QcTicket[];
  events: OEvent[];
}) {
  const sections = [
    { label: "Clientes activos",   value: summary?.activeClients ?? "—",    icon: Users,        ok: (summary?.activeClients ?? 0) > 0 },
    { label: "Proyectos activos",  value: summary?.activeProjects ?? "—",   icon: FolderKanban, ok: true },
    { label: "Tareas vencidas",    value: summary?.overdueTasks ?? 0,       icon: CheckSquare,  ok: (summary?.overdueTasks ?? 0) === 0 },
    { label: "Facturas vencidas",  value: summary?.overdueInvoices ?? 0,    icon: Receipt,      ok: (summary?.overdueInvoices ?? 0) === 0 },
    { label: "Aprobaciones pend.", value: summary?.pendingApprovals ?? 0,   icon: Shield,       ok: (summary?.pendingApprovals ?? 0) === 0 },
    { label: "Incidentes abiertos",value: incidents.filter((i) => i.status !== "resolved" && i.status !== "closed").length, icon: AlertTriangle, ok: false },
    { label: "Tickets QA abiertos",value: qcTickets.filter((q) => q.status !== "closed" && q.status !== "resolved").length, icon: Target, ok: false },
    { label: "Agentes activos",    value: agents.filter((a) => a.status === "active").length, icon: Bot, ok: true },
    { label: "Workflows activos",  value: workflows.filter((w) => w.status === "active").length, icon: GitBranch, ok: true },
    { label: "Eventos hoy",        value: events.filter((e) => new Date(e.createdAt).toDateString() === new Date().toDateString()).length, icon: Activity, ok: true },
    { label: "MRR",                value: fmtMoney(summary?.mrr ?? 0),      icon: DollarSign,   ok: true },
    { label: "ARR",                value: fmtMoney(summary?.arr ?? 0),      icon: TrendingUp,   ok: true },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Revisión General — {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {sections.map(({ label, value, icon: Icon, ok }) => (
            <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10">
              <Icon className="h-4 w-4 text-primary/60 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-bold">{String(value)}</p>
              </div>
              {ok ? <CircleCheck className="h-4 w-4 text-green-400 flex-shrink-0" /> : <CircleAlert className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Próximamente: ejecución automática por IA</p>
      </DialogContent>
    </Dialog>
  );
}

export function CoreAIDashboard() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const s = summary as DashSummary | undefined;

  const { data: rawAgents = [] }     = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const { data: rawWorkflows = [] }  = useListWorkflows({}, { query: { queryKey: getListWorkflowsQueryKey({}) } });
  const { data: rawInvoices = [] }   = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey({}) } });
  const { data: rawContracts = [] }  = useListContracts({}, { query: { queryKey: getListContractsQueryKey({}) } });
  const { data: rawProspects = [] }  = useListProspects({}, { query: { queryKey: getListProspectsQueryKey({}) } });
  const { data: rawAutomations = []} = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });
  const { data: rawIncidents = [] }  = useListIncidents({}, { query: { queryKey: getListIncidentsQueryKey({}) } });
  const { data: rawQcTickets = [] }  = useListQcTickets({}, { query: { queryKey: getListQcTicketsQueryKey({}) } });
  const { data: rawRevenue }         = useGetRevenueSummary({ query: { queryKey: getGetRevenueSummaryQueryKey() } });
  const { data: rawEvents = [] }     = useListOrchestrationEvents({}, { query: { queryKey: getListOrchestrationEventsQueryKey({}) } });

  const agents     = rawAgents     as Agent[];
  const workflows  = rawWorkflows  as Workflow[];
  const invoices   = rawInvoices   as Invoice[];
  const contracts  = rawContracts  as Contract[];
  const prospects  = rawProspects  as Prospect[];
  const automations= rawAutomations as Automation[];
  const incidents  = rawIncidents  as Incident[];
  const qcTickets  = rawQcTickets  as QcTicket[];
  const revenue    = rawRevenue    as RevSummary | undefined;
  const events     = rawEvents     as OEvent[];

  const { data: rawIntegrations = [] } = useListIntegrations({}, { query: { queryKey: getListIntegrationsQueryKey({}) } });
  const { data: rawExecs = [] } = useListAiExecutions({ query: { queryKey: getListAiExecutionsQueryKey() } });
  const integrations = rawIntegrations as Integ[];
  const executions   = rawExecs        as AiExec[];

  // Derived counts
  const overdueInvoices   = invoices.filter((i) => i.status === "overdue");
  const pendingContracts  = contracts.filter((c) => c.status === "draft" || c.status === "pending" || c.status === "review");
  const activeWorkflows   = workflows.filter((w) => w.status === "active");
  const activeAgents      = agents.filter((a) => a.status === "active");
  const pausedAgents      = agents.filter((a) => a.status === "paused");
  const inactiveAgents    = agents.filter((a) => a.status === "inactive");
  const openIncidents     = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed");
  const openQcTickets     = qcTickets.filter((q) => q.status !== "closed" && q.status !== "resolved");
  const activeAutomations  = automations.filter((a) => a.status === "active");
  const errorAutomations   = automations.filter((a) => a.status === "error");
  const draftAutomations   = automations.filter((a) => a.status === "draft");
  const todayAutoExec      = automations.reduce((s, a) => s + (a.executionsToday ?? 0), 0);
  const failedExecs        = executions.filter((e) => e.result === "error");
  const successExecs       = executions.filter((e) => e.result === "success");
  const qcExecs            = executions.filter((e) => e.sentToQc);
  const recentEvents       = events.slice(0, 5);
  const activeIntegrations = integrations.filter((i) => i.status === "active").length;
  const errorIntegrations  = integrations.filter((i) => i.status === "error").length;
  const pendingIntegrations= integrations.filter((i) => i.status === "attention" || i.status === "configured").length;
  const unconfiguredIntegrations = integrations.filter((i) => i.status === "not_configured").length;

  // Decision Center — build priority list
  const priorities: Priority[] = [];
  if ((s?.overdueTasks ?? 0) > 0)
    priorities.push({ label: `${s!.overdueTasks} tarea${s!.overdueTasks > 1 ? "s" : ""} vencida${s!.overdueTasks > 1 ? "s" : ""}`, detail: "Requieren atención inmediata", href: "/tasks", level: "critical" });
  if (overdueInvoices.length > 0)
    priorities.push({ label: `${overdueInvoices.length} factura${overdueInvoices.length > 1 ? "s" : ""} vencida${overdueInvoices.length > 1 ? "s" : ""}`, detail: "Cobro pendiente", href: "/finance/invoices", level: "critical" });
  if ((s?.pendingApprovals ?? 0) > 0)
    priorities.push({ label: `${s!.pendingApprovals} aprobación${s!.pendingApprovals > 1 ? "es" : ""} pendiente${s!.pendingApprovals > 1 ? "s" : ""}`, detail: "Revisión requerida", href: "/approvals", level: "high" });
  if (openIncidents.length > 0)
    priorities.push({ label: `${openIncidents.length} incidente${openIncidents.length > 1 ? "s" : ""} abierto${openIncidents.length > 1 ? "s" : ""}`, detail: "Quality Center activo", href: "/quality-center/incidents", level: "high" });
  if (pendingContracts.length > 0)
    priorities.push({ label: `${pendingContracts.length} contrato${pendingContracts.length > 1 ? "s" : ""} pendiente${pendingContracts.length > 1 ? "s" : ""}`, detail: "En revisión o borrador", href: "/contracts", level: "medium" });
  if (openQcTickets.length > 0)
    priorities.push({ label: `${openQcTickets.length} ticket${openQcTickets.length > 1 ? "s" : ""} QA abierto${openQcTickets.length > 1 ? "s" : ""}`, detail: "Requieren seguimiento", href: "/quality-center", level: "medium" });

  // Smart recommendations (derived from system state)
  const recommendations: string[] = [];
  if ((s?.overdueTasks ?? 0) > 0)   recommendations.push(`Revisar y reasignar ${s!.overdueTasks} tarea${s!.overdueTasks > 1 ? "s" : ""} vencida${s!.overdueTasks > 1 ? "s" : ""}`);
  if (overdueInvoices.length > 0)   recommendations.push(`Gestionar cobro de ${overdueInvoices.length} factura${overdueInvoices.length > 1 ? "s" : ""} vencida${overdueInvoices.length > 1 ? "s" : ""}`);
  if ((s?.pendingApprovals ?? 0) > 0) recommendations.push(`Aprobar ${s!.pendingApprovals} entregable${s!.pendingApprovals > 1 ? "s" : ""} pendiente${s!.pendingApprovals > 1 ? "s" : ""} en Client Room`);
  if (pendingContracts.length > 0)  recommendations.push(`Revisar ${pendingContracts.length} contrato${pendingContracts.length > 1 ? "s" : ""} en borrador`);
  if (activeWorkflows.length === 0) recommendations.push("No hay workflows activos — verificar proyectos en producción");
  if (pausedAgents.length > 0)      recommendations.push(`Reactivar ${pausedAgents.length} agente${pausedAgents.length > 1 ? "s" : ""} IA pausado${pausedAgents.length > 1 ? "s" : ""}`);
  if (openIncidents.length > 0)     recommendations.push(`Resolver ${openIncidents.length} incidente${openIncidents.length > 1 ? "s" : ""} abierto${openIncidents.length > 1 ? "s" : ""} en Quality Center`);
  if (errorAutomations.length > 0)  recommendations.push(`Revisar ${errorAutomations.length} automatización${errorAutomations.length > 1 ? "es" : ""} con error en Automation Engine`);
  if (failedExecs.length > 0)       recommendations.push(`${failedExecs.length} ejecución${failedExecs.length > 1 ? "es" : ""} de agente IA con error — revisar en AI Execution Engine`);
  if (recommendations.length === 0) recommendations.push("El sistema opera sin alertas. Buen trabajo, Camila.");

  // Module health
  const moduleHealth: Array<{ label: string; href: string; health: ModuleHealth; detail: string }> = [
    { label: "HQ Operations",     href: "/hq",               health: "ok",      detail: "Operativo" },
    { label: "Workflow Engine",   href: "/workflow-engine",  health: activeWorkflows.length > 0 ? "ok" : "warning",  detail: activeWorkflows.length > 0 ? `${activeWorkflows.length} activos` : "Sin workflows activos" },
    { label: "Quality Center",    href: "/quality-center",   health: openIncidents.length > 0 ? "error" : openQcTickets.length > 0 ? "warning" : "ok", detail: openIncidents.length > 0 ? `${openIncidents.length} incidentes` : `${openQcTickets.length} tickets` },
    { label: "Smart Onboarding",  href: "/onboarding",       health: "ok",      detail: "Operativo" },
    { label: "Client Room",       href: "/client",           health: (s?.pendingApprovals ?? 0) > 0 ? "warning" : "ok", detail: (s?.pendingApprovals ?? 0) > 0 ? `${s!.pendingApprovals} aprobaciones` : "Sin pendientes" },
    { label: "Contratos",         href: "/contracts",        health: pendingContracts.length > 0 ? "warning" : "ok", detail: pendingContracts.length > 0 ? `${pendingContracts.length} pendientes` : "Al día" },
    { label: "Automatizaciones",  href: "/automations",      health: activeAutomations.length > 0 ? "ok" : "warning", detail: `${activeAutomations.length} activas` },
    { label: "AI Agents",         href: "/agents",           health: activeAgents.length > 0 ? "ok" : "warning", detail: `${activeAgents.length} activos` },
  ];

  // Agenda placeholder
  const agendaItems = [
    { label: "Revisión financiera mensual", time: "Pendiente", type: "reminder" },
    { label: "Seguimiento pipeline comercial", time: "Esta semana", type: "task" },
    { label: "Renovación dominios activos", time: "Próximo mes", type: "deadline" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">COIMAGEN CORE AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{getHour()}, Camila.</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>
        <Button onClick={() => setReviewOpen(true)} className="gap-2 bg-primary/90 hover:bg-primary shrink-0">
          <RefreshCw className="h-4 w-4" />Ejecutar Revisión General
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: "Clientes activos",    value: s?.activeClients ?? "—",     icon: Users,       href: "/clients",                  color: "text-primary" },
          { label: "Prospectos",           value: prospects.length,            icon: User,        href: "/commercial/prospects",     color: "text-blue-400" },
          { label: "Workflows activos",   value: activeWorkflows.length,      icon: GitBranch,   href: "/workflow-engine",          color: "text-violet-400" },
          { label: "Proyectos activos",   value: s?.activeProjects ?? "—",    icon: FolderKanban,href: "/projects",                 color: "text-teal-400" },
          { label: "Tareas críticas",     value: s?.overdueTasks ?? 0,        icon: CheckSquare, href: "/tasks",                    color: (s?.overdueTasks ?? 0) > 0 ? "text-red-400" : "text-green-400" },
          { label: "Contratos pend.",     value: pendingContracts.length,     icon: FileText,    href: "/contracts",                color: pendingContracts.length > 0 ? "text-orange-400" : "text-green-400" },
          { label: "Facturas vencidas",   value: overdueInvoices.length,      icon: Receipt,     href: "/finance/invoices",         color: overdueInvoices.length > 0 ? "text-red-400" : "text-green-400" },
          { label: "Producción",          value: `${activeWorkflows.length}W`, icon: Cpu,         href: "/workflow-engine",         color: "text-cyan-400" },
          { label: "Calidad",             value: openQcTickets.length === 0 ? "OK" : `${openQcTickets.length} tickets`, icon: Shield, href: "/quality-center", color: openQcTickets.length > 0 ? "text-yellow-400" : "text-green-400" },
          { label: "Incidentes",          value: openIncidents.length === 0 ? "OK" : openIncidents.length, icon: AlertTriangle, href: "/quality-center/incidents", color: openIncidents.length > 0 ? "text-red-400" : "text-green-400" },
          { label: "Automatizaciones",    value: activeAutomations.length,    icon: Zap,         href: "/automations",              color: "text-amber-400" },
          { label: "Agentes activos",     value: activeAgents.length,         icon: Bot,         href: "/agents",                   color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}>
            <Card className="border-border/40 hover:border-primary/20 transition-colors cursor-pointer h-full">
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <Icon className={`h-4 w-4 ${color} opacity-70`} />
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                </div>
                <p className={`text-xl font-bold ${color}`}>{String(value)}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Decision Center */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              Centro de Decisiones
              <span className="text-[10px] text-muted-foreground ml-auto font-normal">¿Qué requiere atención?</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {priorities.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <CircleCheck className="h-5 w-5 text-green-400" />
                <p className="text-sm text-muted-foreground">Sin alertas activas. Todo bajo control.</p>
              </div>
            ) : (
              priorities.map((p, i) => (
                <Link key={i} href={p.href}>
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer border-border/40">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${p.level === "critical" ? "bg-red-400" : p.level === "high" ? "bg-orange-400" : "bg-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">{p.detail}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] py-0 flex-shrink-0 ${
                      p.level === "critical" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                      p.level === "high"     ? "bg-orange-400/10 text-orange-400 border-orange-400/30" :
                      "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
                    }`}>{p.level === "critical" ? "Urgente" : p.level === "high" ? "Alta" : "Media"}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Smart Recommendations */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recomendaciones Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-sm">{r}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Global Monitor + Financial */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global Monitor */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              Monitor Global de Módulos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-1.5">
            {moduleHealth.map(({ label, href, health, detail }) => (
              <Link key={label} href={href}>
                <div className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-md hover:bg-muted/30 transition-colors cursor-pointer">
                  <HealthDot health={health} />
                  <p className="text-xs flex-1">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{detail}</p>
                  <Badge variant="outline" className={`text-[9px] py-0 flex-shrink-0 ${
                    health === "ok"      ? "bg-green-400/10 text-green-400 border-green-400/30" :
                    health === "warning" ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30" :
                    health === "error"   ? "bg-red-400/10 text-red-400 border-red-400/30" :
                    "bg-muted/20 text-muted-foreground"
                  }`}>{health === "ok" ? "OK" : health === "warning" ? "Alerta" : health === "error" ? "Error" : "—"}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Integration Hub Summary */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plug className="h-4 w-4 text-primary" />
                  Integration Hub
                </CardTitle>
                <Link href="/integrations"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-muted/40">Ver todo</Badge></Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-2 gap-3">
              {[
                { label: "Activas",           value: activeIntegrations,     color: "text-green-400" },
                { label: "Con error",         value: errorIntegrations,      color: errorIntegrations > 0 ? "text-red-400" : "text-muted-foreground" },
                { label: "Pendientes",        value: pendingIntegrations,    color: pendingIntegrations > 0 ? "text-yellow-400" : "text-muted-foreground" },
                { label: "No configuradas",   value: unconfiguredIntegrations, color: "text-muted-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Automation Engine Summary */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Automation Engine
                </CardTitle>
                <Link href="/automations"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-muted/40">Ver todo</Badge></Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-2 gap-3">
              {[
                { label: "Activas",           value: activeAutomations.length,  color: "text-green-400" },
                { label: "Con error",         value: errorAutomations.length,   color: errorAutomations.length > 0 ? "text-red-400" : "text-muted-foreground" },
                { label: "Borrador",          value: draftAutomations.length,   color: "text-muted-foreground" },
                { label: "Ejecuciones hoy",   value: todayAutoExec,             color: todayAutoExec > 0 ? "text-amber-400" : "text-muted-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Execution Engine Summary */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  AI Execution Engine
                </CardTitle>
                <Link href="/executions"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-muted/40">Ver todo</Badge></Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-2 gap-3">
              {[
                { label: "Total",        value: executions.length,      color: "text-foreground" },
                { label: "Con error",    value: failedExecs.length,     color: failedExecs.length > 0 ? "text-red-400" : "text-muted-foreground" },
                { label: "Exitosas",     value: successExecs.length,    color: "text-green-400" },
                { label: "En QC",        value: qcExecs.length,         color: qcExecs.length > 0 ? "text-purple-400" : "text-muted-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "MRR",             value: fmtMoney(revenue?.mrr ?? s?.mrr ?? 0),  color: "text-primary" },
                  { label: "ARR",             value: fmtMoney(revenue?.arr ?? s?.arr ?? 0),  color: "text-primary" },
                  { label: "Facturación",     value: `${invoices.length} facturas`,           color: "text-muted-foreground" },
                  { label: "Cobrado",         value: `${invoices.filter((i) => i.status === "paid").length} pagadas`, color: "text-green-400" },
                  { label: "Pendiente",       value: `${invoices.filter((i) => i.status === "sent" || i.status === "draft").length} en espera`, color: "text-yellow-400" },
                  { label: "Vencidas",        value: overdueInvoices.length > 0 ? `${overdueInvoices.length} urgente${overdueInvoices.length > 1 ? "s" : ""}` : "Al día", color: overdueInvoices.length > 0 ? "text-red-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[9px] text-muted-foreground">{label}</p>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Resumen IA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center gap-4">
                {[
                  { label: "Activos",    value: activeAgents.length,  color: "text-green-400" },
                  { label: "Pausados",   value: pausedAgents.length,  color: "text-yellow-400" },
                  { label: "En desarrollo", value: inactiveAgents.length, color: "text-muted-foreground" },
                ].map(({ label, value, color }) => (
                  <Link key={label} href="/agents" className="flex-1 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-[9px] text-muted-foreground">{label}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operational + Agenda + Events */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Operational Summary */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Resumen Operativo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5">
            {[
              { label: "Clientes",  value: `${s?.activeClients ?? 0} activos / ${s?.totalClients ?? 0} total`,    icon: Users },
              { label: "Proyectos", value: `${s?.activeProjects ?? 0} activos`,                                    icon: FolderKanban },
              { label: "Workflow",  value: `${activeWorkflows.length} corriendo`,                                  icon: GitBranch },
              { label: "QA",        value: openQcTickets.length === 0 ? "Sin tickets abiertos" : `${openQcTickets.length} abiertos`, icon: Shield },
              { label: "Tickets",   value: `${openIncidents.length} incidentes abiertos`,                          icon: AlertTriangle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium">{value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CEO Agenda */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />Agenda CEO
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {agendaItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Bell className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                  item.type === "task" ? "text-blue-400" : item.type === "deadline" ? "text-orange-400" : "text-yellow-400"
                }`} />
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
            <Separator className="opacity-30 my-1" />
            <p className="text-[9px] text-muted-foreground italic">Agenda sincronizada próximamente con Google Calendar</p>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />Eventos Recientes
              <Button variant="ghost" size="sm" className="h-5 text-[9px] ml-auto gap-0.5 px-1" asChild>
                <Link href="/orchestration/events"><ChevronRight className="h-3 w-3" /></Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin eventos registrados</p>
            ) : (
              recentEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    e.status === "completed" ? "bg-green-400" : e.status === "failed" ? "bg-red-400" : e.status === "active" ? "bg-blue-400" : "bg-yellow-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{getEventLabel(e.eventType)}</p>
                    <p className="text-[9px] text-muted-foreground">{SOURCE_LABELS[e.source] ?? e.source}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground flex-shrink-0">
                    {new Date(e.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        summary={s}
        agents={agents}
        workflows={workflows}
        incidents={incidents}
        qcTickets={qcTickets}
        events={events}
      />
    </div>
  );
}
