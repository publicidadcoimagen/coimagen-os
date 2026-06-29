import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApprovals,
  useCreateApproval,
  useUpdateApproval,
  getListApprovalsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldCheck, Check, X, Archive } from "lucide-react";
import { formatDate } from "@/lib/format";

const TYPE_ES: Record<string, string> = { diagnosis: "Diagnóstico", proposal: "Propuesta", content: "Contenido", automation: "Automatización", production: "Producción", report: "Reporte", campaign: "Campaña", invoice: "Factura", email: "Email" };
const STATUS_ES: Record<string, string> = { draft: "Borrador", pending_approval: "Pendiente", approved: "Aprobado", rejected: "Rechazado", executed: "Ejecutado", archived: "Archivado" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending_approval: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  executed: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  archived: "bg-muted/40 text-muted-foreground/50 border-border/30",
};
const TYPE_COLOR: Record<string, string> = {
  diagnosis: "bg-cyan-500/20 text-cyan-300", proposal: "bg-blue-500/20 text-blue-300",
  content: "bg-pink-500/20 text-pink-300", campaign: "bg-fuchsia-500/20 text-fuchsia-300",
  invoice: "bg-emerald-500/20 text-emerald-300", email: "bg-amber-500/20 text-amber-300",
  automation: "bg-orange-500/20 text-orange-300", production: "bg-red-500/20 text-red-300",
  report: "bg-indigo-500/20 text-indigo-300",
};
const ALL_STATUSES = ["draft", "pending_approval", "approved", "rejected", "executed", "archived"];
const ALL_TYPES = ["diagnosis", "proposal", "content", "automation", "production", "report", "campaign", "invoice", "email"];

export function Approvals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data: approvals, isLoading } = useListApprovals({}, { query: { queryKey: getListApprovalsQueryKey() } });
  const createApproval = useCreateApproval();
  const updateApproval = useUpdateApproval();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "proposal", submittedBy: "", notes: "" });

  const filtered = approvals?.filter((a) => tab === "all" || a.status === tab) ?? [];

  const act = (id: number, status: string) => {
    updateApproval.mutate({ id, data: { status: status as "approved", reviewedBy: "Camila Segovia" } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() })
    });
  };

  const handleSubmit = () => {
    if (!form.title) return;
    createApproval.mutate({ data: { title: form.title, type: form.type as "proposal", status: "pending_approval", submittedBy: form.submittedBy || undefined, notes: form.notes || undefined } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() }); setOpen(false); setForm({ title: "", type: "proposal", submittedBy: "", notes: "" }); }
    });
  };

  const pendingCount = approvals?.filter((a) => a.status === "pending_approval").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Centro de Aprobaciones</h1>
          {pendingCount > 0 && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">{pendingCount} pendientes</Badge>}
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Solicitud</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ key: "all", label: "Todas" }, ...ALL_STATUSES.map((s) => ({ key: s, label: STATUS_ES[s] }))].map(({ key, label }) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)} className="text-xs h-7">{label}</Button>
        ))}
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Enviado por</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[a.type] ?? "bg-muted text-muted-foreground"}`}>{TYPE_ES[a.type] ?? a.type}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[a.status]}`}>{STATUS_ES[a.status] ?? a.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{a.submittedBy ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {a.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => act(a.id, "approved")}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => act(a.id, "rejected")}><X className="h-3 w-3" /></Button>
                        </>
                      )}
                      {["approved", "rejected", "executed"].includes(a.status) && (
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => act(a.id, "archived")}><Archive className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin solicitudes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Solicitud de Aprobación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_ES[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Enviado por</Label><Input value={form.submittedBy} onChange={(e) => setForm({ ...form, submittedBy: e.target.value })} placeholder="Nombre o agente" /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title || createApproval.isPending}>{createApproval.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
