import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useListProspects, getListProspectsQueryKey,
  useListInvoices, getListInvoicesQueryKey,
  useListBacklogItems, getListBacklogItemsQueryKey,
  useListBugs, getListBugsQueryKey,
  useListAutomations, getListAutomationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Receipt, CheckSquare, Bot, Zap, Target, AlertTriangle, Layers } from "lucide-react";

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIs() {
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: prospects } = useListProspects({}, { query: { queryKey: getListProspectsQueryKey() } });
  const { data: invoices } = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey() } });
  const { data: backlog } = useListBacklogItems({ query: { queryKey: getListBacklogItemsQueryKey() } });
  const { data: bugs } = useListBugs({ query: { queryKey: getListBugsQueryKey() } });
  const { data: automations } = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });

  const leadCount = prospects?.filter((p) => p.status === "lead").length ?? 0;
  const diagCompleted = prospects?.filter((p) => p.status === "qualified").length ?? 0;
  const propSent = prospects?.filter((p) => p.status === "disqualified").length ?? 0;
  const closed = prospects?.filter((p) => p.status === "converted").length ?? 0;

  const totalMrr = invoices?.filter((i) => i.status === "paid")
    .reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;

  const openBugs = bugs?.filter((b) => b.status !== "closed" && b.status !== "fixed").length ?? 0;
  const criticalBugs = bugs?.filter((b) => b.severity === "critical" && b.status !== "closed").length ?? 0;
  const inProgressTasks = backlog?.filter((i) => i.status === "in_progress").length ?? 0;
  const activeAutomations = automations?.filter((a) => a.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPIs</h1>
          <p className="text-sm text-muted-foreground">Indicadores clave — datos en tiempo real</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
          Actualizado ahora
        </Badge>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Comercial</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Leads Nuevos" value={leadCount} color="bg-primary/10 text-primary" />
          <KpiCard icon={Target} label="Diagnósticos" value={diagCompleted} color="bg-secondary/10 text-secondary" />
          <KpiCard icon={TrendingUp} label="Propuestas Enviadas" value={propSent} color="bg-blue-400/10 text-blue-400" />
          <KpiCard icon={CheckSquare} label="Ventas Cerradas" value={closed} color="bg-green-400/10 text-green-400" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Finanzas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Receipt} label="Ingresos Cobrados" value={`$${totalMrr.toLocaleString()}`} sub="Facturas pagadas" color="bg-green-400/10 text-green-400" />
          <KpiCard icon={Receipt} label="Facturas Vencidas" value={summary?.overdueInvoices ?? 0} color="bg-orange-400/10 text-orange-400" />
          <KpiCard icon={Users} label="Clientes Activos" value={summary?.activeClients ?? 0} color="bg-primary/10 text-primary" />
          <KpiCard icon={TrendingUp} label="Proyectos Activos" value={summary?.activeProjects ?? 0} color="bg-secondary/10 text-secondary" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Operaciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Layers} label="En Desarrollo" value={inProgressTasks} sub="Backlog items" color="bg-yellow-400/10 text-yellow-400" />
          <KpiCard icon={CheckSquare} label="Tareas Atrasadas" value={summary?.overdueTasks ?? 0} color="bg-red-400/10 text-red-400" />
          <KpiCard icon={AlertTriangle} label="Bugs Abiertos" value={openBugs} sub={criticalBugs > 0 ? `${criticalBugs} críticos` : undefined} color="bg-destructive/10 text-destructive" />
          <KpiCard icon={Bot} label="Agentes Activos" value={summary?.totalAgents ?? 0} color="bg-purple-400/10 text-purple-400" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Automatizaciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Zap} label="Automatizaciones Activas" value={activeAutomations} color="bg-accent/10 text-accent" />
          <KpiCard icon={CheckSquare} label="Aprobaciones Pendientes" value={summary?.pendingApprovals ?? 0} color="bg-yellow-400/10 text-yellow-400" />
        </div>
      </div>
    </div>
  );
}
