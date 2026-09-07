import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCosts,
  useCreateCost,
  useUpdateCost,
  useDeleteCost,
  useGetCostSummary,
  useGetProviderCosts,
  getListCostsQueryKey,
  getGetCostSummaryQueryKey,
  getGetProviderCostsQueryKey,
} from "@workspace/api-client-react";
import type { ProviderCostsResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BarChart3, Pencil, Trash2, Cloud, Server, Database, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const now = new Date();
const CURRENT_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const CATEGORIES: { key: string; label: string }[] = [
  { key: "openai", label: "OpenAI" },
  { key: "claude", label: "Claude (Anthropic)" },
  { key: "gemini", label: "Gemini" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "n8n", label: "n8n" },
  { key: "hosting", label: "Hosting" },
  { key: "replit", label: "Replit" },
  { key: "other", label: "Otro" },
];

const CAT_COLORS: Record<string, string> = {
  openai: "#10a37f", claude: "#e07b39", gemini: "#4285f4",
  whatsapp: "#25d366", n8n: "#ef5d31", hosting: "#6366f1",
  replit: "#f56040", other: "#6b7280",
};

export function Costs() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const { data: costs, isLoading } = useListCosts({ month }, { query: { queryKey: getListCostsQueryKey({ month }) } });
  const { data: summary } = useGetCostSummary(month, { query: { queryKey: getGetCostSummaryQueryKey(month) } });
  const { data: providerCosts, isLoading: providerCostsLoading } = useGetProviderCosts({
    query: { queryKey: getGetProviderCostsQueryKey() },
  });
  const createCost = useCreateCost();
  const updateCost = useUpdateCost();
  const deleteCost = useDeleteCost();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "openai", amount: "", notes: "" });

  const handleSubmit = () => {
    if (!form.amount) return;
    const data = { category: form.category as "openai", month, amount: parseFloat(form.amount), notes: form.notes || undefined };
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: getListCostsQueryKey({ month }) });
      qc.invalidateQueries({ queryKey: getGetCostSummaryQueryKey(month) });
    };
    if (editing) {
      updateCost.mutate({ id: editing, data }, { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setForm({ category: "openai", amount: "", notes: "" }); } });
    } else {
      createCost.mutate({ data }, { onSuccess: () => { invalidate(); setOpen(false); setForm({ category: "openai", amount: "", notes: "" }); } });
    }
  };

  const openEdit = (c: { id: number; category: string; amount: number; notes?: string | null }) => {
    setEditing(c.id); setForm({ category: c.category, amount: String(c.amount), notes: c.notes ?? "" }); setOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteCost.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListCostsQueryKey({ month }) }); qc.invalidateQueries({ queryKey: getGetCostSummaryQueryKey(month) }); } });
  };

  const chartData = (costs ?? []).map((c) => ({ name: CATEGORIES.find((k) => k.key === c.category)?.label ?? c.category, amount: c.amount, fill: CAT_COLORS[c.category] ?? "#6b7280" }));
  const marginColor = (summary?.estimatedMargin ?? 0) >= 50 ? "text-emerald-400" : (summary?.estimatedMargin ?? 0) >= 20 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Motor de Costos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 h-8 text-sm" />
          <Button onClick={() => { setEditing(null); setForm({ category: "openai", amount: "", notes: "" }); setOpen(true); }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Costo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Total Costos</div><div className="text-2xl font-bold text-red-400">{formatCurrency(summary?.totalCosts ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Ingresos del Mes</div><div className="text-2xl font-bold text-emerald-400">{formatCurrency(summary?.totalRevenue ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Margen Estimado</div><div className={`text-2xl font-bold ${marginColor}`}>{summary?.estimatedMargin ?? 0}%</div></CardContent></Card>
      </div>

      <ProviderCostsPanel data={providerCosts} isLoading={providerCostsLoading} />

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Distribución de costos — {month}</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Costo"]} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">% del total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Notas</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {costs?.map((c) => {
                const cat = CATEGORIES.find((k) => k.key === c.category);
                const pct = summary?.breakdown.find((b) => b.category === c.category)?.percentage ?? 0;
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CAT_COLORS[c.category] ?? "#6b7280" }} />{cat?.label ?? c.category}</span></td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(c.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pct}%</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.notes ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!costs?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin costos registrados para {month}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Editar Costo" : "Registrar Costo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Monto (USD) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.amount || createCost.isPending || updateCost.isPending}>{editing ? "Guardar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Netlify and Render expose no billing/invoice API at all (confirmed against
// their own docs) — only Netlify's flat monthly plan price is a real dollar
// figure. Render only offers real service/plan inventory, no cost. Neon's
// consumption API gives real usage units, not $, and needs a NEON_API_KEY
// that isn't provisioned yet. Every number below is either real or clearly
// marked as unavailable — nothing here is simulated.
function ProviderCostsPanel({ data, isLoading }: { data?: ProviderCostsResponse; isLoading: boolean }) {
  if (isLoading) {
    return <Card><CardContent className="p-4 text-sm text-muted-foreground">Consultando Netlify, Render y Neon...</CardContent></Card>;
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gasto real de proveedores (en vivo)</CardTitle>
        <p className="text-xs text-muted-foreground">Datos leídos directamente de las APIs de Netlify, Render y Neon — no manuales.</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-0">
        <ProviderCard icon={<Cloud className="h-4 w-4" />} name="Netlify">
          {data.netlify.ok ? (
            <>
              <p className="text-xl font-bold">{formatCurrency(data.netlify.monthlyDollarPrice ?? 0)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
              <p className="text-xs text-muted-foreground">Plan {data.netlify.planName}</p>
              <p className="text-xs text-muted-foreground">Créditos: {data.netlify.creditsUsed} / {data.netlify.creditsIncluded}</p>
            </>
          ) : <ProviderError message={data.netlify.error} />}
        </ProviderCard>

        <ProviderCard icon={<Server className="h-4 w-4" />} name="Render">
          {data.render.ok ? (
            <>
              <p className="text-xs text-muted-foreground mb-1">Render no expone costo vía API — inventario real de servicios:</p>
              {(data.render.services ?? []).map((s) => (
                <p key={s.id} className="text-xs"><span className="font-medium">{s.name}</span> — plan {s.plan}{s.suspended !== "not_suspended" ? " (suspendido)" : ""}</p>
              ))}
              {(data.render.services ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sin servicios.</p>}
            </>
          ) : <ProviderError message={data.render.error} />}
        </ProviderCard>

        <ProviderCard icon={<Database className="h-4 w-4" />} name="Neon">
          {data.neon.ok ? (
            (data.neon.consumption ?? []).map((c) => (
              <div key={c.projectId} className="text-xs space-y-0.5">
                <p className="font-medium">{c.projectId}</p>
                <p className="text-muted-foreground">Cómputo: {c.computeUnitSeconds.toLocaleString()} CU-s</p>
                <p className="text-muted-foreground">Transferencia: {(c.dataTransferBytes / 1e9).toFixed(2)} GB</p>
              </div>
            ))
          ) : <ProviderError message={data.neon.error} />}
        </ProviderCard>
      </CardContent>
    </Card>
  );
}

function ProviderCard({ icon, name, children }: { icon: ReactNode; name: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">{icon}{name}</div>
      {children}
    </div>
  );
}

function ProviderError({ message }: { message: string | null }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
