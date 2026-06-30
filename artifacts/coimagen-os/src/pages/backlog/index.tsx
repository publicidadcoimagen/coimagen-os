import { useState } from "react";
import {
  useListBacklogItems, useCreateBacklogItem, useUpdateBacklogItem, useDeleteBacklogItem,
  getListBacklogItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Layers, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const STATUSES = [
  { key: "icebox", label: "Icebox", color: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
  { key: "backlog", label: "Backlog", color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  { key: "in_progress", label: "En Desarrollo", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  { key: "in_testing", label: "En Pruebas", color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  { key: "production", label: "Producción", color: "text-green-400 bg-green-400/10 border-green-400/30" },
  { key: "done", label: "Terminado", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
];

const PRIORITIES = ["critical", "high", "medium", "low"];
const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400", high: "text-orange-400", medium: "text-yellow-400", low: "text-blue-400"
};
const EPICS = ["Sitio Web", "COIMAGEN OS", "Marketing", "Productos", "Branding", "Automatización", "Ventas", "Agentes IA", "SEO", "Google Business"];
const ASSIGNEES = ["Camila", "Replit", "ChatGPT CTO", "Agente IA"];

const EMPTY_FORM = { title: "", description: "", epic: "", priority: "medium", assignee: "", sprint: "", status: "backlog", dueDate: "", notes: "" };

export function Backlog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: items = [], isLoading } = useListBacklogItems({ query: { queryKey: getListBacklogItemsQueryKey() } });
  const create = useCreateBacklogItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBacklogItemsQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Ítem creado" }); } } });
  const update = useUpdateBacklogItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBacklogItemsQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Ítem actualizado" }); } } });
  const del = useDeleteBacklogItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBacklogItemsQueryKey() }); toast({ title: "Ítem eliminado" }); } } });

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (item: typeof items[0]) => {
    setEditing(item.id);
    setForm({ title: item.title, description: item.description ?? "", epic: item.epic ?? "", priority: item.priority, assignee: item.assignee ?? "", sprint: item.sprint ?? "", status: item.status, dueDate: item.dueDate ?? "", notes: item.notes ?? "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editing) {
      update.mutate({ id: editing, data: form });
    } else {
      create.mutate({ data: form });
    }
  };

  const handleStatusChange = (id: number, status: string) => {
    update.mutate({ id, data: { status } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Backlog</h1>
          <p className="text-sm text-muted-foreground">{items.length} ítems en el backlog</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo Ítem
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando backlog...</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {STATUSES.map(({ key, label, color }) => {
            const colItems = items.filter((i) => i.status === key);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className={`text-xs ${color}`}>{label}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{colItems.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {colItems.map((item) => (
                    <Card key={item.id} className="border-border/50 hover:border-primary/30 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.epic && <p className="text-[10px] text-muted-foreground mt-0.5">{item.epic}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {item.priority && (
                                <span className={`text-[10px] font-medium ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                                  ↑ {item.priority}
                                </span>
                              )}
                              {item.assignee && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.assignee}</span>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(item)}>Editar</DropdownMenuItem>
                              {STATUSES.filter((s) => s.key !== key).map((s) => (
                                <DropdownMenuItem key={s.key} onClick={() => handleStatusChange(item.id, s.key)}>
                                  Mover a {s.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem className="text-destructive" onClick={() => del.mutate({ id: item.id })}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {colItems.length === 0 && (
                    <div className="border-2 border-dashed border-border/30 rounded-lg h-20 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/40">Vacío</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Ítem" : "Nuevo Ítem de Backlog"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título del ítem" className="mt-1" /></div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 h-20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Epic</Label>
                <Select value={form.epic} onValueChange={(v) => setForm({ ...form, epic: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{EPICS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsable</Label>
                <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sprint</Label><Input value={form.sprint} onChange={(e) => setForm({ ...form, sprint: e.target.value })} placeholder="Ej. Sprint 1" className="mt-1" /></div>
              <div><Label>Fecha Objetivo</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title.trim()}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
