import { useState } from "react";
import {
  useListRoadmapItems, useCreateRoadmapItem, useUpdateRoadmapItem, useDeleteRoadmapItem,
  getListRoadmapItemsQueryKey,
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
import { Map, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-400/10 text-slate-400 border-slate-400/30",
  in_progress: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  completed: "bg-green-400/10 text-green-400 border-green-400/30",
  paused: "bg-orange-400/10 text-orange-400 border-orange-400/30",
};
const STATUS_LABELS: Record<string, string> = { planned: "Planeado", in_progress: "En Progreso", completed: "Completado", paused: "Pausado" };

const VERSIONS = ["COIMAGEN OS V1.6", "COIMAGEN OS V1.7", "COIMAGEN OS V2.0", "coimagenmedia.com V1.3", "coimagenmedia.com V1.4", "Medical OS", "Restaurant OS", "Lawyer OS", "Real Estate OS"];
const EMPTY_FORM = { version: "", objective: "", status: "planned", priority: "medium", estimatedDate: "", dependencies: "", deliverables: "", risks: "" };

export function Roadmap() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: items = [], isLoading } = useListRoadmapItems({ query: { queryKey: getListRoadmapItemsQueryKey() } });
  const create = useCreateRoadmapItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRoadmapItemsQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Item creado" }); } } });
  const update = useUpdateRoadmapItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRoadmapItemsQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Actualizado" }); } } });
  const del = useDeleteRoadmapItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRoadmapItemsQueryKey() }); toast({ title: "Eliminado" }); } } });

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (item: typeof items[0]) => {
    setEditing(item.id);
    setForm({ version: item.version, objective: item.objective, status: item.status, priority: item.priority ?? "medium", estimatedDate: item.estimatedDate ?? "", dependencies: item.dependencies ?? "", deliverables: item.deliverables ?? "", risks: item.risks ?? "" });
    setOpen(true);
  };

  const grouped = VERSIONS.reduce((acc, v) => {
    acc[v] = items.filter((i) => i.version === v);
    return acc;
  }, {} as Record<string, typeof items>);
  const otherItems = items.filter((i) => !VERSIONS.includes(i.version));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground">{items.length} elementos en el roadmap</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-6">
          {[...VERSIONS, ...(otherItems.length > 0 ? ["Otros"] : [])].map((version) => {
            const vItems = version === "Otros" ? otherItems : grouped[version] ?? [];
            if (vItems.length === 0 && version !== "COIMAGEN OS V1.6") return null;
            return (
              <div key={version}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  {version}
                  <span className="text-xs text-muted-foreground/60">({vItems.length})</span>
                </h2>
                {vItems.length === 0 ? (
                  <div className="border-2 border-dashed border-border/30 rounded-lg p-4 text-center text-xs text-muted-foreground/40">Sin items</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {vItems.map((item) => (
                      <Card key={item.id} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.objective}</p>
                              {item.estimatedDate && <p className="text-xs text-muted-foreground mt-0.5">📅 {item.estimatedDate}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[item.status] ?? ""}`}>
                                {STATUS_LABELS[item.status] ?? item.status}
                              </Badge>
                            </div>
                          </div>
                          {item.deliverables && <p className="text-xs text-muted-foreground mb-2">📦 {item.deliverables}</p>}
                          {item.risks && <p className="text-xs text-orange-400/80 mb-2">⚠️ {item.risks}</p>}
                          <div className="flex gap-1 mt-3">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: item.id })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Item" : "Nuevo Item de Roadmap"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Versión *</Label>
              <Select value={form.version} onValueChange={(v) => setForm({ ...form, version: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar versión" /></SelectTrigger>
                <SelectContent>{VERSIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Objetivo *</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="mt-1 h-16" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planeado</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha Estimada</Label><Input type="date" value={form.estimatedDate} onChange={(e) => setForm({ ...form, estimatedDate: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Entregables</Label><Textarea value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} className="mt-1 h-14" /></div>
            <div><Label>Riesgos</Label><Textarea value={form.risks} onChange={(e) => setForm({ ...form, risks: e.target.value })} className="mt-1 h-14" /></div>
            <div><Label>Dependencias</Label><Textarea value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: e.target.value })} className="mt-1 h-14" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.version || !form.objective) return; editing ? update.mutate({ id: editing, data: form }) : create.mutate({ data: form }); }} disabled={!form.version || !form.objective}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
