import {
  useGetRevenueSummary,
  useGetMrrTrend,
  useListInvoices,
  useListClients,
  useListSubscriptions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function Revenue() {
  const { data: summary, isLoading } = useGetRevenueSummary();
  const { data: mrrTrend } = useGetMrrTrend();
  const { data: invoices } = useListInvoices();
  const { data: clients } = useListClients();
  const { data: subs } = useListSubscriptions();

  const highTicket = invoices?.filter((i) => i.status === "paid" && i.amount >= 5000) ?? [];
  const activeSubClientIds = new Set(subs?.filter((s) => s.status === "active").map((s) => s.clientId).filter(Boolean));
  const dormant = clients?.filter((c) => c.status === "active" && !activeSubClientIds.has(c.id)) ?? [];

  const STATS = [
    { label: "MRR", value: formatCurrency(summary?.mrr ?? 0), color: "text-emerald-400" },
    { label: "ARR", value: formatCurrency(summary?.arr ?? 0), color: "text-emerald-300" },
    { label: "Suscripciones activas", value: String(summary?.activeSubscriptions ?? 0), color: "text-primary" },
    { label: "Clientes dormidos", value: String(summary?.dormantCount ?? 0), color: "text-amber-400" },
    { label: "Alto ticket (#)", value: String(summary?.highTicketCount ?? 0), color: "text-violet-400" },
    { label: "Alto ticket (total)", value: formatCurrency(summary?.highTicketTotal ?? 0), color: "text-violet-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Motor de Ingresos</h1>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATS.map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{s.label}</div>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Tendencia MRR — Últimos 6 meses</CardTitle></CardHeader>
            <CardContent className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrTrend ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "MRR"]} />
                  <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Alto Ticket — Facturas &gt; $5,000</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {highTicket.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                      <div><div className="font-medium">{inv.clientName ?? "-"}</div><div className="text-xs text-muted-foreground">{inv.number} · {formatDate(inv.issuedDate)}</div></div>
                      <span className="font-bold text-emerald-400">{formatCurrency(inv.amount)}</span>
                    </div>
                  ))}
                  {highTicket.length === 0 && <p className="text-sm text-muted-foreground">Sin facturas de alto ticket.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Clientes Dormidos <Badge variant="outline" className="ml-2 text-xs">{dormant.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dormant.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                      <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.company ?? "-"} · {c.industry ?? "-"}</div></div>
                      <span className="text-xs text-amber-400 font-medium">Sin suscripción activa</span>
                    </div>
                  ))}
                  {dormant.length === 0 && <p className="text-sm text-muted-foreground">No hay clientes dormidos.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
