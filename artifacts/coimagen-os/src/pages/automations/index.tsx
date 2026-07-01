import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAutomations, useCreateAutomation,
  getListAutomationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Zap, Plus, ChevronRight, CheckCircle2, XCircle,
  PauseCircle, Archive, FileEdit,
} from "lucide-react";
import {
  AUTOMATION_STATUSES, AUTOMATION_PRIORITIES,
  TRIGGER_TYPES, INTERNAL_ACTIONS,
} from "./catalog";

type Automation = {
  id: number; name: string; description?: string | null; status: string;
  triggerType?: string | null; priority: string;
  totalExecutions: number; executionsToday: number;
  errors?: string | null; lastRun?: string | null; createdAt: string;
};

function StatusIcon({ status }: { status: string }) {
  if (status === "active")   return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
  if (status === "error")    return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (status === "paused")   return <PauseCircle className="h-3.5 w-3.5 text-yellow-400" />;
  if (status === "archived") return <Archive className="h-3.5 w-3.5 text-slate-400" />;
  return <FileEdit className="h-3.5 w-3.5 text-muted-foreground" />;
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [triggerType, setTrigger]   = useState("");
  const [priority, setPriority]     = useState("medium");
  const [status, setStatus]         = useState("draft");
  const [selectedActions, setActions] = useState<string[]>([]);

  const { mutate: create, isPending } = useCreateAutomation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
        onClose();
        setName(""); setDesc(""); setTrigger(""); setPriority("medium"); setStatus("draft"); setActions([]);
      },
    },
  });

  function toggleAction(a: string) {
    setActions((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  function handleCreate() {
    if (!name.trim()) return;
    create({
      data: {
        name,
        description: description || undefined,
        triggerType: triggerType || undefined,
        actionsConfig: selectedActions.length > 0 ? JSON.stringify(selectedActions) : undefined,
        priority,
        status,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Nueva automatización</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          <div className="space-y-1.5"><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Notificar al CEO cuando hay factura vencida" /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTrigger}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AUTOMATION_PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estado inicial</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(AUTOMATION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Acciones internas (opcional)</Label>
            <div className="space-y-1.5">
              {INTERNAL_ACTIONS.map((a) => (
                <button key={a.value} type="button"
                  className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border transition-colors ${selectedActions.includes(a.value) ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/20"}`}
                  onClick={() => toggleAction(a.value)}>
                  <div className={`h-3.5 w-3.5 rounded border flex-shrink-0 mt-0.5 ${selectedActions.includes(a.value) ? "bg-primary border-primary" : "border-border"}`} />
                  <div>
                    <p className="text-xs font-medium">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? "Creando..." : "Crear automatización"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Automations() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: rawItems = [], isLoading } = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });
  const automations = rawItems as Automation[];

  const filtered = statusFilter === "all" ? automations : automations.filter((a) => a.status === statusFilter);

  const counts = {
    all:      automations.length,
    active:   automations.filter((a) => a.status === "active").length,
    draft:    automations.filter((a) => a.status === "draft").length,
    paused:   automations.filter((a) => a.status === "paused").length,
    error:    automations.filter((a) => a.status === "error").length,
    archived: automations.filter((a) => a.status === "archived").length,
  };

  const todayExecutions = automations.reduce((sum, a) => sum + (a.executionsToday ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Automation Engine</h1>
            <p className="text-sm text-muted-foreground">{automations.length} automatizaciones · {todayExecutions} ejecuciones hoy</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nueva automatización
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { key: "all",      label: "Total",      color: "text-foreground" },
          { key: "active",   label: "Activas",    color: "text-green-400" },
          { key: "draft",    label: "Borrador",   color: "text-muted-foreground" },
          { key: "paused",   label: "Pausadas",   color: "text-yellow-400" },
          { key: "error",    label: "Con error",  color: "text-red-400" },
          { key: "archived", label: "Archivadas", color: "text-slate-400" },
        ].map(({ key, label, color }) => (
          <Card key={key}
            className={`border-border/40 cursor-pointer transition-all ${statusFilter === key ? "border-primary/40 bg-primary/5" : ""}`}
            onClick={() => setStatusFilter(key)}>
            <CardContent className="p-3">
              <p className={`text-xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(AUTOMATION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStatusFilter("all")}>Limpiar</Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <Zap className="h-12 w-12 opacity-20" />
          <p className="text-sm">{automations.length === 0 ? "No hay automatizaciones configuradas" : "Sin resultados con el filtro seleccionado"}</p>
          {automations.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Crear primera automatización
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((automation) => {
            const sm = AUTOMATION_STATUSES[automation.status] ?? AUTOMATION_STATUSES["draft"];
            const pr = AUTOMATION_PRIORITIES[automation.priority] ?? AUTOMATION_PRIORITIES["medium"];
            const trigger = TRIGGER_TYPES.find((t) => t.value === automation.triggerType);
            return (
              <Link key={automation.id} href={`/automations/${automation.id}`}>
                <Card className="border-border/40 hover:border-primary/20 transition-all cursor-pointer group">
                  <CardContent className="p-3 flex items-center gap-3">
                    <StatusIcon status={automation.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{automation.name}</p>
                        <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
                        <span className={`text-[10px] font-medium ${pr.color}`}>{pr.label}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-0.5">
                        {trigger && <span className="text-[10px] text-muted-foreground">⚡ {trigger.label}</span>}
                        {automation.description && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-sm">{automation.description}</span>
                        )}
                        {automation.status === "error" && automation.errors && (
                          <span className="text-[10px] text-red-400 truncate">⚠ {automation.errors}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-[10px] text-muted-foreground">{automation.totalExecutions ?? 0} ejecuciones</p>
                      {automation.lastRun && (
                        <p className="text-[10px] text-muted-foreground">{new Date(automation.lastRun).toLocaleDateString("es-MX")}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
