import { useState } from "react";
import {
  useListIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea, getListIdeasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Lightbulb, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  review: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  approved: "bg-green-400/15 text-green-400 border-green-400/30",
  discarded: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  in_backlog: "bg-primary/15 text-primary border-primary/30",
};
const STATUS_LABELS: Record<string, string> = { new: "Nueva", review: "Revisar", approved: "Aprobada", discarded: "Descartada", in_backlog: "En Backlog" };
const AREAS = ["Producto", "Marketing", "Automatización", "Clientes", "Finanzas", "Agentes IA", "SEO", "UX/UI", "Ventas", "Ops"];

const EMPTY_FORM = { title: "", description: "", area: "", impact: "", complexity: "", status: "new", notes: "" };

export function Ideas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: ideas = [], isLoading } = useListIdeas({ query: { queryKey: getListIdeasQueryKey() } });
  const create = useCreateIdea({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListIdeasQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Idea registrada" }); } } });
  const update = useUpdateIdea({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListIdeasQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Idea actualizada" }); } } });
  const del = useDeleteIdea({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListIdeasQueryKey() }); toast({ title: "Idea eliminada" }); } } });

  const openEdit = (i: typeof ideas[0]) => {
    setEditing(i.id);
    setForm({ title: i.title, description: i.description ?? "", area: i.area ?? "", impact: i.impact ?? "", complexity: i.complexity ?? "", status: i.status, notes: i.notes ?? "" });
    setOpen(true);
  };

  const filtered = statusFilter === "all" ? ideas : ideas.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-yellow-400/10 flex items-center justify-center">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ideas</h1>
          <p className="text-sm text-muted-foreground">{ideas.length} ideas capturadas</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nueva Idea
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "new", "review", "approved", "discarded", "in_backlog"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
            {s === "all" ? "Todas" : STATUS_LABELS[s] ?? s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((idea) => (
            <Card key={idea.id} className="border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-sm">{idea.title}</p>
                  <Badge variant="outline" className={`text-xs flex-shrink-0 ${STATUS_COLORS[idea.status] ?? ""}`}>
                    {STATUS_LABELS[idea.status] ?? idea.status}
                  </Badge>
                </div>
                {idea.description && <p className="text-xs text-muted-foreground mb-3">{idea.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {idea.area && <span className="bg-muted px-1.5 py-0.5 rounded">{idea.area}</span>}
                  {idea.impact && <span>↑ {idea.impact}</span>}
                  {idea.complexity && <span>⚙ {idea.complexity}</span>}
                </div>
                <div className="flex gap-1 mt-3">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(idea)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: idea.id })}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">Sin ideas en esta categoría</div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Idea" : "Nueva Idea"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 h-20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Área</Label>
                <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Impacto Esperado</Label><Input value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="mt-1" placeholder="Alto / Medio / Bajo" /></div>
              <div><Label>Complejidad</Label><Input value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value })} className="mt-1" placeholder="Alta / Media / Baja" /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.title.trim()) return; editing ? update.mutate({ id: editing, data: form }) : create.mutate({ data: form }); }} disabled={!form.title.trim()}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
