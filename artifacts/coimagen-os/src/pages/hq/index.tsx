import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useListBacklogItems, getListBacklogItemsQueryKey,
  useListBugs, getListBugsQueryKey,
  useListDailySprints, getListDailySprintsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Target, AlertTriangle, CheckSquare, TrendingUp, Users, Receipt,
  Bot, Zap, ArrowRight, Calendar, Layers, Lightbulb
} from "lucide-react";

function MetricCard({ icon: Icon, label, value, color, href }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-bold">{value}</p>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            <span>Ver detalle</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function HQ() {
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: backlog } = useListBacklogItems({ query: { queryKey: getListBacklogItemsQueryKey() } });
  const { data: bugs } = useListBugs({ query: { queryKey: getListBugsQueryKey() } });
  const { data: sprints } = useListDailySprints({ query: { queryKey: getListDailySprintsQueryKey() } });

  const activeSprint = sprints?.find((s) => s.status === "active") ?? sprints?.[sprints.length - 1];
  const inProgress = backlog?.filter((i) => i.status === "in_progress").length ?? 0;
  const pendingItems = backlog?.filter((i) => i.status === "backlog").length ?? 0;
  const criticalBugs = bugs?.filter((b) => b.severity === "critical" && b.status !== "closed").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HQ Operations</h1>
          <p className="text-sm text-muted-foreground">Mission Control — Centro operativo de Coimagen</p>
        </div>
        <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary/30 text-xs">
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </Badge>
      </div>

      {activeSprint && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Sprint Activo — {activeSprint.date}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSprint.objective && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Objetivo del día</p>
                <p className="text-sm font-medium">{activeSprint.objective}</p>
              </div>
            )}
            {activeSprint.replitWorking && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Replit está trabajando en</p>
                <p className="text-sm">{activeSprint.replitWorking}</p>
              </div>
            )}
            {activeSprint.blockers && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{activeSprint.blockers}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Layers} label="En Desarrollo" value={inProgress} color="bg-blue-500/10 text-blue-400" href="/backlog" />
        <MetricCard icon={CheckSquare} label="Backlog Pendiente" value={pendingItems} color="bg-secondary/10 text-secondary" href="/backlog" />
        <MetricCard icon={AlertTriangle} label="Bugs Críticos" value={criticalBugs} color="bg-destructive/10 text-destructive" href="/bugs" />
        <MetricCard icon={Users} label="Prospectos Activos" value={summary?.activeClients ?? 0} color="bg-primary/10 text-primary" href="/commercial/prospects" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={TrendingUp} label="Proyectos Activos" value={summary?.activeProjects ?? 0} color="bg-accent/10 text-accent" href="/projects" />
        <MetricCard icon={Receipt} label="Facturas Vencidas" value={summary?.overdueInvoices ?? 0} color="bg-orange-500/10 text-orange-400" href="/finance/invoices" />
        <MetricCard icon={Bot} label="Agentes Activos" value={summary?.totalAgents ?? 0} color="bg-purple-500/10 text-purple-400" href="/agents" />
        <MetricCard icon={Zap} label="Tareas Atrasadas" value={summary?.overdueTasks ?? 0} color="bg-red-500/10 text-red-400" href="/tasks" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Backlog por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {[
              { key: "icebox", label: "Icebox" },
              { key: "backlog", label: "Backlog" },
              { key: "in_progress", label: "En Desarrollo" },
              { key: "in_testing", label: "En Pruebas" },
              { key: "production", label: "Producción" },
              { key: "done", label: "Terminado" },
            ].map(({ key, label }) => {
              const count = backlog?.filter((i) => i.status === key).length ?? 0;
              return (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Badge variant="outline" className="text-xs h-5">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Acciones Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.overdueInvoices ?? 0) > 0 && (
              <Link href="/finance/invoices">
                <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/10 text-orange-400 text-xs cursor-pointer hover:bg-orange-500/20 transition-colors">
                  <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{summary?.overdueInvoices} facturas vencidas requieren atención</span>
                </div>
              </Link>
            )}
            {criticalBugs > 0 && (
              <Link href="/bugs">
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs cursor-pointer hover:bg-destructive/20 transition-colors">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{criticalBugs} bugs críticos sin resolver</span>
                </div>
              </Link>
            )}
            {(summary?.pendingApprovals ?? 0) > 0 && (
              <Link href="/approvals">
                <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/10 text-secondary text-xs cursor-pointer hover:bg-secondary/20 transition-colors">
                  <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{summary?.pendingApprovals} aprobaciones pendientes</span>
                </div>
              </Link>
            )}
            {!activeSprint && (
              <Link href="/daily-sprint">
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 text-primary text-xs cursor-pointer hover:bg-primary/20 transition-colors">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>No hay sprint activo — iniciar el día</span>
                </div>
              </Link>
            )}
            {(summary?.overdueInvoices ?? 0) === 0 && criticalBugs === 0 && (summary?.pendingApprovals ?? 0) === 0 && activeSprint && (
              <p className="text-xs text-muted-foreground py-2 text-center">✓ Todo en orden</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
