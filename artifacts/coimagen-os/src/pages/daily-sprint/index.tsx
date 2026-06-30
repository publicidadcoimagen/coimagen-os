import { useState } from "react";
import {
  useListDailySprints, useCreateDailySprint, useUpdateDailySprint, useDeleteDailySprint,
  getListDailySprintsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  objective: "", doneYesterday: "", replitWorking: "", todayPlan: "",
  blockers: "", deliverables: "", result: "", tomorrowPending: "", status: "active"
};

export function DailySprint() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: sprints = [], isLoading } = useListDailySprints({ query: { queryKey: getListDailySprintsQueryKey() } });
  const create = useCreateDailySprint({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDailySprintsQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Sprint creado" }); } } });
  const update = useUpdateDailySprint({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDailySprintsQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Sprint actualizado" }); } } });
  const del = useDeleteDailySprint({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDailySprintsQueryKey() }); toast({ title: "Sprint eliminado" }); } } });

  const sorted = [...sprints].sort((a, b) => b.date.localeCompare(a.date));
  const active = sorted.find((s) => s.status === "active");

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (s: typeof sprints[0]) => {
    setEditing(s.id);
    setForm({ date: s.date, objective: s.objective ?? "", doneYesterday: s.doneYesterday ?? "", replitWorking: s.replitWorking ?? "", todayPlan: s.todayPlan ?? "", blockers: s.blockers ?? "", deliverables: s.deliverables ?? "", result: s.result ?? "", tomorrowPending: s.tomorrowPending ?? "", status: s.status ?? "active" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.date) return;
    if (editing) update.mutate({ id: editing, data: form });
    else create.mutate({ data: form });
  };

  const field = (key: keyof typeof form, label: string, required = false) => (
    <div key={key}>
      <Label className="text-xs">{label}{required && " *"}</Label>
      <Textarea value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 h-16 text-sm" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Sprint</h1>
          <p className="text-sm text-muted-foreground">{sprints.length} registros de sprint</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo Sprint
        </Button>
      </div>

      {active && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Sprint Activo — {active.date}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(active)}>Editar</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => del.mutate({ id: active.id })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {active.objective && <div><p className="text-xs text-muted-foreground mb-0.5">Objetivo</p><p>{active.objective}</p></div>}
            {active.replitWorking && <div><p className="text-xs text-muted-foreground mb-0.5">Replit trabaja en</p><p>{active.replitWorking}</p></div>}
            {active.todayPlan && <div><p className="text-xs text-muted-foreground mb-0.5">Plan hoy</p><p>{active.todayPlan}</p></div>}
            {active.blockers && <div><p className="text-xs text-muted-foreground mb-0.5 text-destructive">Bloqueos</p><p className="text-destructive">{active.blockers}</p></div>}
            {active.deliverables && <div><p className="text-xs text-muted-foreground mb-0.5">Entregables</p><p>{active.deliverables}</p></div>}
            {active.tomorrowPending && <div><p className="text-xs text-muted-foreground mb-0.5">Para mañana</p><p>{active.tomorrowPending}</p></div>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Historial</h2>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
        ) : (
          sorted.filter((s) => s.id !== active?.id).map((s) => (
            <Card key={s.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{s.date}</span>
                  {s.objective && <span className="text-sm text-muted-foreground truncate flex-1">{s.objective}</span>}
                  <div className="flex items-center gap-1 ml-auto">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(s)}>Editar</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: s.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                      {expanded === s.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {expanded === s.id && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm border-t border-border/30 pt-3">
                    {s.doneYesterday && <div><p className="text-xs text-muted-foreground mb-0.5">Terminó ayer</p><p>{s.doneYesterday}</p></div>}
                    {s.replitWorking && <div><p className="text-xs text-muted-foreground mb-0.5">Replit trabajó en</p><p>{s.replitWorking}</p></div>}
                    {s.result && <div><p className="text-xs text-muted-foreground mb-0.5">Resultado</p><p>{s.result}</p></div>}
                    {s.tomorrowPending && <div><p className="text-xs text-muted-foreground mb-0.5">Pendientes</p><p>{s.tomorrowPending}</p></div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
        {!isLoading && sorted.filter((s) => s.id !== active?.id).length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Sin historial de sprints</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Sprint" : "Nuevo Daily Sprint"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Fecha *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" /></div>
            {field("objective", "Objetivo del día")}
            {field("doneYesterday", "¿Qué terminó ayer?")}
            {field("replitWorking", "¿Qué está trabajando Replit?")}
            {field("todayPlan", "¿Qué haremos hoy?")}
            {field("blockers", "Bloqueos")}
            {field("deliverables", "Entregables esperados")}
            {field("result", "Resultado final del día")}
            {field("tomorrowPending", "Pendientes para mañana")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.date}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
