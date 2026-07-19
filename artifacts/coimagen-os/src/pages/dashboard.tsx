import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetProjectsByStatus,
  useGetCostSummary,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetProjectsByStatusQueryKey,
  getGetCostSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Users, FolderKanban, CheckSquare, Activity,
  TrendingUp, AlertTriangle, DollarSign, BarChart2,
  ShieldCheck, CreditCard, Clock, UserX, Zap, Wallet,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatDate, formatCurrency } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  openai: "OpenAI", claude: "Claude", gemini: "Gemini", whatsapp: "WhatsApp",
  n8n: "n8n", hosting: "Hosting", replit: "Replit", other: "Otro",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function KpiCard({
  title, value, sub, icon: Icon, color = "text-primary", danger,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-destructive/40" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${danger && (typeof value === "number" ? value > 0 : true) ? "text-destructive" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AlertItem({ icon: Icon, label, value, level = "warn" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  level?: "warn" | "error" | "ok";
}) {
  const colors = { warn: "text-yellow-500", error: "text-destructive", ok: "text-emerald-500" };
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-3.5 w-3.5 ${colors[level]}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${value > 0 ? colors[level] : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  planning: "Planificación",
  on_hold: "En pausa",
  completed: "Completado",
  cancelled: "Cancelado",
};

export function Dashboard() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });
  const { data: projectsByStatus, isLoading: isLoadingProjects } = useGetProjectsByStatus({
    query: { queryKey: getGetProjectsByStatusQueryKey() }
  });
  const { data: costSummary, isLoading: isLoadingCosts } = useGetCostSummary(currentMonth, {
    query: { queryKey: getGetCostSummaryQueryKey(currentMonth) }
  });

  if (isLoadingSummary || isLoadingActivity || isLoadingProjects) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Cargando Mission Control...</div>;
  }

  const topCosts = [...(costSummary?.breakdown ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 4);

  const chartData = projectsByStatus?.map(stat => ({
    name: STATUS_LABELS[stat.status] ?? stat.status,
    value: stat.count,
  })) || [];

  const totalAlerts = (summary?.pendingApprovals ?? 0) + (summary?.overdueInvoices ?? 0) + (summary?.overdueTasks ?? 0);
  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">{totalAlerts} alerta{totalAlerts !== 1 ? "s" : ""} requieren atención</span>
          </div>
        )}
      </div>

      {/* Financial KPIs */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 font-semibold">Finanzas</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="MRR" value={fmt(summary?.mrr ?? 0)} icon={DollarSign} color="text-emerald-500" sub="Ingreso mensual recurrente" />
          <KpiCard title="ARR" value={fmt(summary?.arr ?? 0)} icon={TrendingUp} color="text-emerald-400" sub="Proyección anual" />
          <KpiCard title="Costos del mes" value={fmt(summary?.totalCostsThisMonth ?? 0)} icon={BarChart2} color="text-orange-500" sub="Gastos registrados" />
          <KpiCard title="Margen estimado" value={`${summary?.marginThisMonth ?? 0}%`} icon={Zap} color="text-primary" sub={`MRR - Costos`} />
        </div>
      </div>

      {/* Operational KPIs */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 font-semibold">Operaciones</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Clientes activos" value={summary?.activeClients ?? 0} icon={Users} color="text-primary" sub={`${summary?.totalClients ?? 0} total`} />
          <KpiCard title="Suspendidos" value={summary?.suspendedClients ?? 0} icon={UserX} danger={(summary?.suspendedClients ?? 0) > 0} sub="Requieren seguimiento" />
          <KpiCard title="Proyectos activos" value={summary?.activeProjects ?? 0} icon={FolderKanban} color="text-secondary" sub={`${summary?.completedProjectsThisMonth ?? 0} completados este mes`} />
          <KpiCard title="Tareas abiertas" value={summary?.openTasks ?? 0} icon={CheckSquare} color="text-accent" sub={`${summary?.overdueTasks ?? 0} atrasadas`} danger={(summary?.overdueTasks ?? 0) > 0} />
        </div>
      </div>

      {/* Alerts + Needs Attention + Replit Cost */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Needs Attention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Necesita Atención
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AlertItem icon={CreditCard} label="Facturas vencidas" value={summary?.overdueInvoices ?? 0} level="error" />
            <AlertItem icon={CheckSquare} label="Tareas atrasadas" value={summary?.overdueTasks ?? 0} level="error" />
            <AlertItem icon={ShieldCheck} label="Aprobaciones pendientes" value={summary?.pendingApprovals ?? 0} level="warn" />
            <AlertItem icon={Clock} label="Pagos próximos (7d)" value={summary?.upcomingPayments ?? 0} level="warn" />
            <AlertItem icon={UserX} label="Clientes suspendidos" value={summary?.suspendedClients ?? 0} level="warn" />
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> Centro de Control
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Aprobaciones pendientes</span>
              <span className={`text-sm font-bold ${(summary?.pendingApprovals ?? 0) > 0 ? "text-yellow-500" : "text-muted-foreground"}`}>{summary?.pendingApprovals ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Pagos próximos (7d)</span>
              <span className="text-sm font-bold text-primary">{summary?.upcomingPayments ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Proyectos completados (mes)</span>
              <span className="text-sm font-bold text-emerald-500">{summary?.completedProjectsThisMonth ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Agentes activos</span>
              <span className="text-sm font-bold text-secondary">{summary?.totalAgents ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cost Widget */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" /> Motor de Costos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="text-xs text-muted-foreground mb-2">{currentMonth}</div>
            {isLoadingCosts ? (
              <div className="text-xs text-muted-foreground">Cargando...</div>
            ) : topCosts.length > 0 ? (
              <>
                {topCosts.map((item) => (
                  <div key={item.category} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                    <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-muted-foreground">Total del mes</span>
                  <span className="text-sm font-bold text-orange-400">{formatCurrency(costSummary?.totalCosts ?? 0)}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Sin costos registrados este mes.</div>
            )}
            <Link href="/costs" className="block pt-2 text-xs text-primary hover:underline">
              Ver detalle de costos →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Activity + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity?.map((entry) => (
                <div key={entry.id} className="flex flex-col space-y-0.5 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="text-sm">{entry.description}</div>
                  <div className="flex items-center text-xs text-muted-foreground space-x-1.5">
                    <span>{formatDate(entry.createdAt)}</span>
                    {entry.entityName && (
                      <>
                        <span>•</span>
                        <span>{entry.entityName}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!activity?.length && (
                <div className="text-sm text-muted-foreground">Sin actividad reciente.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Proyectos por Estado</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sin datos de proyectos.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
