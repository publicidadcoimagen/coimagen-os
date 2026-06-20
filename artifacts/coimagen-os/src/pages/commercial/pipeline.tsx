import { useQueryClient } from "@tanstack/react-query";
import {
  useListProspects,
  useUpdateProspect,
  useListProposals,
  getListProspectsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight, UserCheck } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = { lead: "Lead", qualified: "Calificado", disqualified: "Descalificado", converted: "Convertido", draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada" };
const STATUS_COLORS: Record<string, string> = { lead: "text-blue-400", qualified: "text-emerald-400", converted: "text-violet-400", accepted: "text-emerald-400", sent: "text-amber-400", draft: "text-muted-foreground", rejected: "text-red-400" };

export function Pipeline() {
  const qc = useQueryClient();
  const { data: prospects, isLoading: lp } = useListProspects({ query: { queryKey: getListProspectsQueryKey() } });
  const { data: proposals } = useListProposals();
  const updateProspect = useUpdateProspect();

  const counts = { lead: 0, qualified: 0, disqualified: 0, converted: 0 };
  prospects?.forEach((p) => { if (p.status in counts) counts[p.status as keyof typeof counts]++; });
  const qualified = prospects?.filter((p) => p.status === "qualified") ?? [];

  const convert = (id: number) => {
    updateProspect.mutate({ id, data: { status: "converted" } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListProspectsQueryKey() })
    });
  };

  const totalProposalValue = proposals?.filter((p) => p.status === "accepted").reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Comercial</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries({ lead: "Leads", qualified: "Calificados", disqualified: "Descalificados", converted: "Convertidos" }).map(([k, label]) => (
          <Card key={k}>
            <CardContent className="pt-5 pb-4">
              <div className="text-3xl font-bold">{counts[k as keyof typeof counts]}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-400" /> Prospectos Calificados</CardTitle></CardHeader>
          <CardContent>
            {qualified.length === 0 && <p className="text-sm text-muted-foreground">No hay prospectos calificados.</p>}
            <div className="space-y-2">
              {qualified.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.company ?? "-"} · {p.industry ?? "-"}</div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => convert(p.id)}>
                    Convertir <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Propuestas Recientes</CardTitle>
            <p className="text-xs text-muted-foreground">Valor cerrado: <span className="text-emerald-400 font-semibold">{formatCurrency(totalProposalValue)}</span></p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {proposals?.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                  <span className="truncate flex-1 mr-4">{p.title}</span>
                  <span className="text-muted-foreground mr-3 whitespace-nowrap">{formatCurrency(p.amount)}</span>
                  <span className={`text-xs font-medium whitespace-nowrap ${STATUS_COLORS[p.status] ?? "text-muted-foreground"}`}>{STATUS_LABELS[p.status] ?? p.status}</span>
                </div>
              ))}
              {!proposals?.length && <p className="text-sm text-muted-foreground">Sin propuestas registradas.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
