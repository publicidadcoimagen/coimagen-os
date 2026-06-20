import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useListClients,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";

const STATUS_ES: Record<string, string> = { draft: "Borrador", sent: "Enviada", paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  overdue: "bg-red-500/20 text-red-300 border-red-500/30",
  cancelled: "bg-muted/40 text-muted-foreground/60 border-border/30",
};
const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

export function Invoices() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data: invoices, isLoading } = useListInvoices({ query: { queryKey: getListInvoicesQueryKey() } });
  const { data: clients } = useListClients();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", clientId: "", amount: "", status: "draft", issuedDate: "", dueDate: "", description: "" });

  const filtered = invoices?.filter((i) => tab === "all" || i.status === tab) ?? [];
  const totalPaid = invoices?.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalPending = invoices?.filter((i) => i.status === "sent").reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalOverdue = invoices?.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0) ?? 0;

  const handleSubmit = () => {
    if (!form.number || !form.amount) return;
    createInvoice.mutate({ data: { number: form.number, clientId: form.clientId ? parseInt(form.clientId) : undefined, amount: parseFloat(form.amount), status: form.status as "draft", issuedDate: form.issuedDate || undefined, dueDate: form.dueDate || undefined, description: form.description || undefined } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }); setOpen(false); setForm({ number: "", clientId: "", amount: "", status: "draft", issuedDate: "", dueDate: "", description: "" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Factura</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Total Pagado</div><div className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Por Cobrar</div><div className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Vencido</div><div className="text-2xl font-bold text-red-400">{formatCurrency(totalOverdue)}</div></CardContent></Card>
      </div>

      <div className="flex gap-2">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={tab === s ? "default" : "outline"} onClick={() => setTab(s)} className="text-xs h-7">
            {s === "all" ? "Todas" : STATUS_ES[s]}
          </Button>
        ))}
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Emisión</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acción</th>
            </tr></thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.number}</td>
                  <td className="px-4 py-3 font-medium">{inv.clientName ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issuedDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[inv.status]}`}>{STATUS_ES[inv.status] ?? inv.status}</span></td>
                  <td className="px-4 py-3">
                    {inv.status === "sent" && (
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                        updateInvoice.mutate({ id: inv.id, data: { status: "paid" } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }) });
                      }}>Marcar pagada</Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin facturas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Factura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número *</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="INV-007" /></div>
              <div><Label>Monto (USD) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha emisión</Label><Input type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} /></div>
              <div><Label>Fecha vencimiento</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_ES[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.number || !form.amount || createInvoice.isPending}>{createInvoice.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
