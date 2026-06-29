import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDiagnoses,
  useCreateDiagnosis,
  useUpdateDiagnosis,
  getListDiagnosesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Stethoscope } from "lucide-react";
import { formatDate } from "@/lib/format";

const STATUS_ES: Record<string, string> = {
  draft: "Borrador", pending_approval: "Pendiente Aprobación", approved: "Aprobado",
  rejected: "Rechazado", executed: "Ejecutado", archived: "Archivado",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", pending_approval: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  executed: "bg-violet-500/20 text-violet-300 border-violet-500/30", archived: "bg-muted/50 text-muted-foreground/60",
};

const STATUSES = ["draft", "pending_approval", "approved", "rejected", "executed", "archived"];

export function Diagnosis() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const { data: diagnoses, isLoading } = useListDiagnoses({}, { query: { queryKey: getListDiagnosesQueryKey() } });
  const createDiagnosis = useCreateDiagnosis();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", type: "diagnosis", status: "draft" });

  const filtered = diagnoses?.filter((d) => filterStatus === "all" || d.status === filterStatus) ?? [];

  const handleSubmit = () => {
    if (!form.title) return;
    createDiagnosis.mutate({ data: { title: form.title, content: form.content || undefined, type: form.type, status: form.status as "draft" } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListDiagnosesQueryKey() }); setOpen(false); setForm({ title: "", content: "", type: "diagnosis", status: "draft" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Diagnósticos Digitales</h1>
          <Badge variant="outline">{filtered.length}</Badge>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Diagnóstico
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)} className="text-xs h-7">
            {s === "all" ? "Todos" : STATUS_ES[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{d.type}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[d.status]}`}>{STATUS_ES[d.status] ?? d.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin diagnósticos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Diagnóstico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="diagnosis" /></div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_ES[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Contenido</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Describe los hallazgos del diagnóstico..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title || createDiagnosis.isPending}>{createDiagnosis.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
