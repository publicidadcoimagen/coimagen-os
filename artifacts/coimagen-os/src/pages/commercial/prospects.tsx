import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProspects,
  useCreateProspect,
  useUpdateProspect,
  getListProspectsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserSearch } from "lucide-react";
import { formatDate } from "@/lib/format";

const STAGES = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Calificado" },
  { key: "disqualified", label: "Descalificado" },
  { key: "converted", label: "Convertido" },
];

const stageColor: Record<string, string> = {
  lead: "border-blue-500/40 bg-blue-500/5",
  qualified: "border-emerald-500/40 bg-emerald-500/5",
  disqualified: "border-red-500/40 bg-destructive/5",
  converted: "border-violet-500/40 bg-violet-500/5",
};

const badgeColor: Record<string, string> = {
  lead: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  qualified: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  disqualified: "bg-red-500/20 text-red-300 border-red-500/30",
  converted: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

export function Prospects() {
  const qc = useQueryClient();
  const { data: prospects, isLoading } = useListProspects({}, { query: { queryKey: getListProspectsQueryKey() } });
  const createProspect = useCreateProspect();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", industry: "", source: "", notes: "", status: "lead" });

  const handleSubmit = () => {
    if (!form.name) return;
    createProspect.mutate({ data: { name: form.name, email: form.email || undefined, phone: form.phone || undefined, company: form.company || undefined, industry: form.industry || undefined, source: form.source || undefined, notes: form.notes || undefined, status: form.status as "lead" } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProspectsQueryKey() }); setOpen(false); setForm({ name: "", email: "", phone: "", company: "", industry: "", source: "", notes: "", status: "lead" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserSearch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Prospectos</h1>
          <Badge variant="outline">{prospects?.length ?? 0} total</Badge>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Prospecto
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const items = prospects?.filter((p) => p.status === stage.key) ?? [];
            return (
              <div key={stage.key} className={`rounded-xl border p-3 space-y-2 ${stageColor[stage.key]}`}>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {items.map((p) => (
                  <Card key={p.id} className="bg-card/60 border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="font-medium text-sm leading-tight">{p.name}</div>
                      {p.company && <div className="text-xs text-muted-foreground">{p.company}</div>}
                      {p.industry && <div className="text-xs text-muted-foreground/60">{p.industry}</div>}
                      <div className="flex items-center justify-between pt-1">
                        {p.source && <span className="text-[10px] text-muted-foreground/50 border border-border/30 rounded px-1.5 py-0.5">{p.source}</span>}
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">{formatDate(p.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground/40 text-center py-6">Sin prospectos</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo Prospecto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+52 55..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Empresa</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label>Industria</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fuente</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="LinkedIn, referido..." /></div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name || createProspect.isPending}>
              {createProspect.isPending ? "Guardando..." : "Crear Prospecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
