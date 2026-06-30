import { useState } from "react";
import {
  useListAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation,
  getListAutomationsQueryKey,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = ["n8n", "Jotform", "Gmail", "Google Calendar", "Google Sheets", "Replit", "WhatsApp", "Google Business", "Search Console", "Analytics"];
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-400/15 text-green-400 border-green-400/30",
  paused: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  error: "bg-red-400/15 text-red-400 border-red-400/30",
  draft: "bg-slate-400/15 text-slate-400 border-slate-400/30",
};

const EMPTY_FORM = { name: "", description: "", platform: "", status: "active", trigger: "", action: "", lastRun: "", result: "", notes: "" };

export function Automations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: items = [], isLoading } = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });
  const create = useCreateAutomation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAutomationsQueryKey() }); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Automatización creada" }); } } });
  const update = useUpdateAutomation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAutomationsQueryKey() }); setOpen(false); setEditing(null); toast({ title: "Actualizada" }); } } });
  const del = useDeleteAutomation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAutomationsQueryKey() }); toast({ title: "Eliminada" }); } } });

  const openEdit = (a: typeof items[0]) => {
    setEditing(a.id);
    setForm({ name: a.name, description: a.description ?? "", platform: a.platform ?? "", status: a.status, trigger: a.trigger ?? "", action: a.action ?? "", lastRun: a.lastRun ?? "", result: a.result ?? "", notes: a.notes ?? "" });
    setOpen(true);
  };

  const filtered = statusFilter === "all" ? items : items.filter((a) => a.status === statusFilter);
  const activeCount = items.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <Zap className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">{activeCount} activas · {items.length} total</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "active", "paused", "draft", "error"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
            {s === "all" ? "Todas" : s.charAt(0).toUpperCase() + s.slice(1)}
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
                  <TableHead>Automatización</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Ejecución</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{a.name}</p>
                      {a.action && <p className="text-xs text-muted-foreground truncate max-w-xs">{a.action}</p>}
                    </TableCell>
                    <TableCell>
                      {a.platform && <Badge variant="outline" className="text-xs">{a.platform}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.trigger ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLORS[a.status] ?? ""}`}>{a.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.lastRun ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: a.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Sin automatizaciones</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Automatización" : "Nueva Automatización"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 h-16" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plataforma</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="paused">Pausada</SelectItem><SelectItem value="draft">Borrador</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Trigger (Disparador)</Label><Input value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="mt-1" placeholder="Ej. Nuevo formulario enviado" /></div>
            <div><Label>Acción</Label><Input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="mt-1" placeholder="Ej. Enviar email de confirmación" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Última Ejecución</Label><Input value={form.lastRun} onChange={(e) => setForm({ ...form, lastRun: e.target.value })} className="mt-1" placeholder="Ej. 2025-01-15 10:30" /></div>
              <div><Label>Resultado</Label><Input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className="mt-1" placeholder="Ej. Exitoso" /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.name.trim()) return; editing ? update.mutate({ id: editing, data: form }) : create.mutate({ data: form }); }} disabled={!form.name.trim()}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
