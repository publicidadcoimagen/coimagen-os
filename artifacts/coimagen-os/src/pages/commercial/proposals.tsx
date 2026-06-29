import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProposals,
  useCreateProposal,
  useUpdateProposal,
  getListProposalsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";

const STATUS_ES: Record<string, string> = { draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", rejected: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STATUSES = ["draft", "sent", "accepted", "rejected"];

export function Proposals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data: proposals, isLoading } = useListProposals({}, { query: { queryKey: getListProposalsQueryKey() } });
  const createProposal = useCreateProposal();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", status: "draft", validUntil: "", notes: "" });

  const filtered = proposals?.filter((p) => tab === "all" || p.status === tab) ?? [];

  const handleSubmit = () => {
    if (!form.title) return;
    createProposal.mutate({ data: { title: form.title, amount: form.amount ? parseFloat(form.amount) : undefined, status: form.status as "draft", validUntil: form.validUntil || undefined, notes: form.notes || undefined } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProposalsQueryKey() }); setOpen(false); setForm({ title: "", amount: "", status: "draft", validUntil: "", notes: "" }); }
    });
  };

  const totalAccepted = proposals?.filter((p) => p.status === "accepted").reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Propuestas</h1>
          <Badge variant="outline">{filtered.length}</Badge>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Propuesta</Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", ...STATUSES].map((s) => (
            <Button key={s} size="sm" variant={tab === s ? "default" : "outline"} onClick={() => setTab(s)} className="text-xs h-7">
              {s === "all" ? "Todas" : STATUS_ES[s]}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Valor cerrado: <span className="text-emerald-400 font-semibold">{formatCurrency(totalAccepted)}</span></span>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Monto</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Válida hasta</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.validUntil)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[p.status]}`}>{STATUS_ES[p.status] ?? p.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin propuestas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Propuesta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monto (USD)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_ES[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Válida hasta</Label><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title || createProposal.isPending}>{createProposal.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
