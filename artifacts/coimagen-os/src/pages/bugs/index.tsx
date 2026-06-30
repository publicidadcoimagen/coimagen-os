import { useState } from "react";
import {
  useListBugs, useCreateBug, useUpdateBug, useDeleteBug, getListBugsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bug, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-400/30",
  high: "bg-orange-400/15 text-orange-400 border-orange-400/30",
  medium: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  low: "bg-blue-400/15 text-blue-400 border-blue-400/30",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  confirmed: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  in_review: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  fixed: "bg-green-400/15 text-green-400 border-green-400/30",
  closed: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABELS: Record<string, string> = { new: "Nuevo", confirmed: "Confirmado", in_review: "En Revisión", fixed: "Corregido", closed: "Cerrado" };

const EMPTY_FORM = { title: "", description: "", severity: "medium", status: "new", module: "", detectedAt: new Date().toISOString().split("T")[0], resolvedAt: "", assignee: "Replit", notes: "" };

export function Bugs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: bugs = [], isLoading } = useListBugs({ query: { queryKey: getListBugsQueryKey() } });
  const create = useCreateBug({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBugsQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Bug registrado" }); } } });
  const update = useUpdateBug({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBugsQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Bug actualizado" }); } } });
  const del = useDeleteBug({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBugsQueryKey() }); toast({ title: "Bug eliminado" }); } } });

  const openEdit = (b: typeof bugs[0]) => {
    setEditing(b.id);
    setForm({ title: b.title, description: b.description ?? "", severity: b.severity, status: b.status, module: b.module ?? "", detectedAt: b.detectedAt ?? "", resolvedAt: b.resolvedAt ?? "", assignee: b.assignee ?? "", notes: b.notes ?? "" });
    setOpen(true);
  };

  const filtered = statusFilter === "all" ? bugs : bugs.filter((b) => b.status === statusFilter);
  const criticalOpen = bugs.filter((b) => b.severity === "critical" && b.status !== "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Bug className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bug Tracker</h1>
          <p className="text-sm text-muted-foreground">{bugs.length} bugs registrados {criticalOpen > 0 && <span className="text-destructive">· {criticalOpen} críticos abiertos</span>}</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Reportar Bug
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "new", "confirmed", "in_review", "fixed", "closed"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
            {s === "all" ? "Todos" : STATUS_LABELS[s] ?? s}
          </Button>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bug</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.title}</p>
                      {b.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{b.description}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${SEV_COLORS[b.severity] ?? ""}`}>{b.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLORS[b.status] ?? ""}`}>{STATUS_LABELS[b.status] ?? b.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.module ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.assignee ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: b.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Sin bugs en esta categoría</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Bug" : "Reportar Bug"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 h-20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Severidad</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="critical">Crítico</SelectItem><SelectItem value="high">Alto</SelectItem><SelectItem value="medium">Medio</SelectItem><SelectItem value="low">Bajo</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="new">Nuevo</SelectItem><SelectItem value="confirmed">Confirmado</SelectItem><SelectItem value="in_review">En Revisión</SelectItem><SelectItem value="fixed">Corregido</SelectItem><SelectItem value="closed">Cerrado</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Módulo</Label><Input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="mt-1" placeholder="Ej. Facturación" /></div>
              <div><Label>Responsable</Label><Input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="mt-1" placeholder="Ej. Replit" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Detectado</Label><Input type="date" value={form.detectedAt} onChange={(e) => setForm({ ...form, detectedAt: e.target.value })} className="mt-1" /></div>
              <div><Label>Resuelto</Label><Input type="date" value={form.resolvedAt} onChange={(e) => setForm({ ...form, resolvedAt: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.title.trim()) return; editing ? update.mutate({ id: editing, data: form }) : create.mutate({ data: form }); }} disabled={!form.title.trim()}>{editing ? "Guardar" : "Reportar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
