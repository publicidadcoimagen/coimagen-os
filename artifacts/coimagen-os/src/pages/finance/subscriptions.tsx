import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useListClients,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";

const STATUS_ES: Record<string, string> = { active: "Activa", paused: "Pausada", cancelled: "Cancelada" };
const CYCLE_ES: Record<string, string> = { monthly: "Mensual", quarterly: "Trimestral", annual: "Anual" };
const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  paused: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function Subscriptions() {
  const qc = useQueryClient();
  const { data: subs, isLoading } = useListSubscriptions({}, { query: { queryKey: getListSubscriptionsQueryKey() } });
  const { data: clients } = useListClients();
  const createSub = useCreateSubscription();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", plan: "", amount: "", billingCycle: "monthly", startDate: "", nextBillingDate: "", notes: "" });

  const activeSubs = subs?.filter((s) => s.status === "active") ?? [];
  const mrr = activeSubs.reduce((sum, s) => {
    const amt = s.amount;
    if (s.billingCycle === "monthly") return sum + amt;
    if (s.billingCycle === "quarterly") return sum + amt / 3;
    if (s.billingCycle === "annual") return sum + amt / 12;
    return sum;
  }, 0);

  const handleSubmit = () => {
    if (!form.plan || !form.amount) return;
    createSub.mutate({ data: { clientId: form.clientId ? parseInt(form.clientId) : undefined, plan: form.plan, amount: parseFloat(form.amount), billingCycle: form.billingCycle as "monthly", startDate: form.startDate || undefined, nextBillingDate: form.nextBillingDate || undefined, notes: form.notes || undefined } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() }); setOpen(false); setForm({ clientId: "", plan: "", amount: "", billingCycle: "monthly", startDate: "", nextBillingDate: "", notes: "" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Suscripciones</h1>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Suscripción</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">MRR Total</div><div className="text-2xl font-bold text-emerald-400">{formatCurrency(mrr)}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Activas</div><div className="text-2xl font-bold">{activeSubs.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Pausadas / Canceladas</div><div className="text-2xl font-bold text-muted-foreground">{(subs?.length ?? 0) - activeSubs.length}</div></CardContent></Card>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ciclo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Próximo cobro</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
            </tr></thead>
            <tbody>
              {subs?.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.plan}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.clientName ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(s.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{CYCLE_ES[s.billingCycle] ?? s.billingCycle}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(s.nextBillingDate)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[s.status]}`}>{STATUS_ES[s.status] ?? s.status}</span></td>
                </tr>
              ))}
              {!subs?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin suscripciones.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Suscripción</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Plan *</Label><Input value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="Nombre del plan" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monto *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div>
                <Label>Ciclo</Label>
                <Select value={form.billingCycle} onValueChange={(v) => setForm({ ...form, billingCycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CYCLE_ES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Inicio</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>Próximo cobro</Label><Input type="date" value={form.nextBillingDate} onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.plan || !form.amount || createSub.isPending}>{createSub.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
