import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWorkflows,
  getListWorkflowsQueryKey,
  useCreateWorkflow,
  useDeleteWorkflow,
  useListWorkflowTemplates,
  getListWorkflowTemplatesQueryKey,
  useAdvanceWorkflow,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch, Plus, ChevronRight, Trash2, AlertTriangle,
  LayoutList, KanbanSquare, Users, Clock, CheckCircle2,
  ArrowRight, Search, Filter,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; phase: string; color: string }> = {
  lead_received:          { label: "Lead recibido",          phase: "Comercial",   color: "bg-slate-400/20 text-slate-300 border-slate-400/30" },
  diagnosis_started:      { label: "Diagnóstico iniciado",   phase: "Comercial",   color: "bg-blue-400/20 text-blue-300 border-blue-400/30" },
  diagnosis_completed:    { label: "Diagnóstico completado", phase: "Comercial",   color: "bg-blue-500/20 text-blue-300 border-blue-400/30" },
  proposal_sent:          { label: "Propuesta enviada",      phase: "Comercial",   color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30" },
  proposal_approved:      { label: "Propuesta aprobada",     phase: "Comercial",   color: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30" },
  contract_sent:          { label: "Contrato enviado",       phase: "Comercial",   color: "bg-orange-400/20 text-orange-300 border-orange-400/30" },
  contract_signed:        { label: "Contrato firmado",       phase: "Comercial",   color: "bg-orange-500/20 text-orange-300 border-orange-400/30" },
  payment_received:       { label: "Pago inicial recibido",  phase: "Inicio",      color: "bg-green-400/20 text-green-300 border-green-400/30" },
  onboarding_started:     { label: "Onboarding iniciado",    phase: "Inicio",      color: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30" },
  onboarding_completed:   { label: "Onboarding completado",  phase: "Inicio",      color: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30" },
  production_started:     { label: "Producción iniciada",    phase: "Producción",  color: "bg-purple-400/20 text-purple-300 border-purple-400/30" },
  design_review:          { label: "Diseño en revisión",     phase: "Producción",  color: "bg-purple-500/20 text-purple-300 border-purple-400/30" },
  development_review:     { label: "Desarrollo en revisión", phase: "Producción",  color: "bg-violet-400/20 text-violet-300 border-violet-400/30" },
  qa_internal:            { label: "QA interno",             phase: "Producción",  color: "bg-indigo-400/20 text-indigo-300 border-indigo-400/30" },
  changes_requested:      { label: "Cambios solicitados",    phase: "Producción",  color: "bg-red-400/20 text-red-300 border-red-400/30" },
  client_approval:        { label: "Aprobación cliente",     phase: "Cierre",      color: "bg-teal-400/20 text-teal-300 border-teal-400/30" },
  final_delivery:         { label: "Entrega final",          phase: "Cierre",      color: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30" },
  monthly_active:         { label: "Mensualidad activa",     phase: "Mensualidad", color: "bg-green-500/20 text-green-300 border-green-400/30" },
  support_active:         { label: "Soporte activo",         phase: "Mensualidad", color: "bg-green-600/20 text-green-300 border-green-400/30" },
  customer_success:       { label: "Customer Success",       phase: "Mensualidad", color: "bg-amber-400/20 text-amber-300 border-amber-400/30" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:      { label: "Baja",     color: "bg-slate-400/15 text-slate-400 border-slate-400/30" },
  medium:   { label: "Media",    color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  high:     { label: "Alta",     color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  critical: { label: "Crítica",  color: "bg-red-400/15 text-red-400 border-red-400/30" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: "Activo",     color: "bg-green-400/15 text-green-400 border-green-400/30" },
  paused:    { label: "Pausado",    color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  blocked:   { label: "Bloqueado",  color: "bg-red-400/15 text-red-400 border-red-400/30" },
  completed: { label: "Completado", color: "bg-primary/15 text-primary border-primary/30" },
};

const PRODUCTS = [
  "AI Website", "SEO Growth", "Google Business", "AI Automation",
  "Camila AI", "COIMAGEN OS", "Medical OS", "Restaurant OS",
  "Law OS", "Real Estate OS", "Cloud Systems", "Consultoría",
];

type WF = {
  id: number; name: string; product?: string | null; clientId?: number | null;
  projectId?: number | null; status: string; currentStage: string; progress: number;
  priority: string; blockers?: string | null; notes?: string | null;
  startDate?: string | null; targetDate?: string | null; templateId?: number | null;
  createdAt: string; updatedAt?: string | null;
};

type Template = { id: number; name: string; product?: string | null; stages: string[]; defaultPriority: string };

function stageBadge(stage: string) {
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, color: "bg-muted text-muted-foreground border-border/50" };
  return <Badge variant="outline" className={`text-[10px] py-0 ${cfg.color}`}>{cfg.label}</Badge>;
}

// ─── Create Dialog ─────────────────────────────────────────────────────────────
function CreateWorkflowDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [priority, setPriority] = useState("medium");

  const { data: templates = [] } = useListWorkflowTemplates({
    query: { queryKey: getListWorkflowTemplatesQueryKey(), enabled: open },
  });

  const { mutate: createWf, isPending } = useCreateWorkflow({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey({}) });
        navigate(`/workflow-engine/${(data as WF).id}`);
        onClose();
      },
    },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createWf({ data: { name: name.trim(), product: product || undefined, priority, templateId: templateId ?? undefined } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow del cliente XYZ..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Producto</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin especificar</SelectItem>
                {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Plantilla</Label>
            <Select value={templateId ? String(templateId) : ""} onValueChange={(v) => setTemplateId(v ? Number(v) : null)}>
              <SelectTrigger><SelectValue placeholder="Usar plantilla (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin plantilla</SelectItem>
                {(templates as Template[]).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || isPending}>
              {isPending ? "Creando..." : "Crear workflow"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workflow Card ─────────────────────────────────────────────────────────────
function WorkflowCard({ wf, onDelete, onAdvance }: { wf: WF; onDelete: (id: number) => void; onAdvance: (id: number) => void }) {
  const priority = PRIORITY_CONFIG[wf.priority] ?? PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.active;
  return (
    <Card className="border-border/50 hover:border-primary/30 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Link href={`/workflow-engine/${wf.id}`}>
                <span className="font-semibold text-sm hover:text-primary transition-colors">{wf.name}</span>
              </Link>
              <Badge variant="outline" className={`text-[10px] py-0 ${status.color}`}>{status.label}</Badge>
              <Badge variant="outline" className={`text-[10px] py-0 ${priority.color}`}>{priority.label}</Badge>
              {wf.product && <span className="text-[10px] text-muted-foreground">{wf.product}</span>}
            </div>
            <div className="flex items-center gap-2 mb-2">
              {stageBadge(wf.currentStage)}
              {wf.blockers && (
                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />Bloqueado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={wf.progress} className="h-1.5 flex-1 max-w-[150px]" />
              <span className="text-[10px] text-muted-foreground">{wf.progress}%</span>
              {wf.targetDate && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  🎯 {wf.targetDate}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {wf.status !== "completed" && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => onAdvance(wf.id)} title="Avanzar etapa">
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(wf.id)} title="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────
const KANBAN_PHASES = [
  { label: "Comercial", stages: ["lead_received","diagnosis_started","diagnosis_completed","proposal_sent","proposal_approved","contract_sent","contract_signed"] },
  { label: "Inicio", stages: ["payment_received","onboarding_started","onboarding_completed"] },
  { label: "Producción", stages: ["production_started","design_review","development_review","qa_internal","changes_requested"] },
  { label: "Cierre", stages: ["client_approval","final_delivery"] },
  { label: "Mensualidad", stages: ["monthly_active","support_active","customer_success"] },
];

function KanbanView({ workflows, onDelete, onAdvance }: { workflows: WF[]; onDelete: (id: number) => void; onAdvance: (id: number) => void }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {KANBAN_PHASES.map((phase) => {
          const phaseWfs = workflows.filter((w) => phase.stages.includes(w.currentStage));
          return (
            <div key={phase.label} className="w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">{phase.label}</span>
                <Badge variant="outline" className="text-[10px] py-0 bg-muted/20">{phaseWfs.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px] p-2 border border-dashed border-border/30 rounded-lg">
                {phaseWfs.length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground/40">vacío</div>
                ) : phaseWfs.map((wf) => (
                  <div key={wf.id} className="bg-card border border-border/50 rounded-lg p-2.5 hover:border-primary/30 transition-all">
                    <Link href={`/workflow-engine/${wf.id}`}>
                      <p className="text-xs font-medium leading-tight hover:text-primary truncate">{wf.name}</p>
                    </Link>
                    <div className="flex items-center gap-1 mt-1.5">
                      {stageBadge(wf.currentStage)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Progress value={wf.progress} className="h-1 flex-1" />
                      <span className="text-[9px] text-muted-foreground">{wf.progress}%</span>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-primary" onClick={() => onAdvance(wf.id)}>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function WorkflowEngine() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");

  const { data: rawWf = [], isLoading } = useListWorkflows({}, {
    query: { queryKey: getListWorkflowsQueryKey({}) },
  });

  const { mutate: deleteWf } = useDeleteWorkflow({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey({}) });
        setDeleteId(null);
      },
    },
  });

  const { mutate: advanceWf } = useAdvanceWorkflow({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey({}) }),
    },
  });

  const all = (rawWf as WF[]);
  const workflows = all.filter((w) => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.product?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && w.status !== filterStatus) return false;
    if (filterProduct !== "all" && w.product !== filterProduct) return false;
    return true;
  });

  const stats = {
    total: all.length,
    active: all.filter((w) => w.status === "active").length,
    completed: all.filter((w) => w.status === "completed").length,
    blocked: all.filter((w) => !!w.blockers).length,
  };

  const blockedWfs = workflows.filter((w) => !!w.blockers);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workflow Engine</h1>
            <p className="text-sm text-muted-foreground">Motor de procesos operativos — Lead → Customer Success</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/workflow-engine/templates">Plantillas</Link>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Nuevo Workflow
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: GitBranch },
          { label: "Activos", value: stats.active, icon: Clock },
          { label: "Completados", value: stats.completed, icon: CheckCircle2 },
          { label: "Bloqueados", value: stats.blocked, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
                <Icon className="h-6 w-6 text-primary/15" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline visual */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {Object.entries(STAGE_CONFIG).map(([key, cfg], i, arr) => (
              <div key={key} className="flex items-center flex-shrink-0">
                <div className={`px-2 py-1 rounded text-[9px] font-medium border ${cfg.color}`}>
                  {cfg.label}
                </div>
                {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar workflows..." className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los productos</SelectItem>
            {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterProduct !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterProduct("all"); }}>
            <Filter className="h-3 w-3 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list">
        <TabsList className="h-8">
          <TabsTrigger value="list" className="text-xs gap-1.5"><LayoutList className="h-3 w-3" />Lista</TabsTrigger>
          <TabsTrigger value="kanban" className="text-xs gap-1.5"><KanbanSquare className="h-3 w-3" />Kanban</TabsTrigger>
          <TabsTrigger value="blocked" className="text-xs gap-1.5">
            <AlertTriangle className="h-3 w-3" />Bloqueos {stats.blocked > 0 && <Badge variant="outline" className="text-[9px] py-0 ml-0.5 bg-red-400/10 text-red-400 border-red-400/30">{stats.blocked}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          {isLoading ? (
            <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16 bg-muted/20" /></Card>)}</div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
              <GitBranch className="h-10 w-10 opacity-20" />
              <p className="text-sm">No hay workflows registrados</p>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Crear primer workflow
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((wf) => (
                <WorkflowCard key={wf.id} wf={wf} onDelete={setDeleteId} onAdvance={(id) => advanceWf({ id, data: {} })} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
          ) : (
            <KanbanView workflows={workflows} onDelete={setDeleteId} onAdvance={(id) => advanceWf({ id, data: {} })} />
          )}
        </TabsContent>

        <TabsContent value="blocked" className="mt-3">
          {blockedWfs.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 opacity-20" />
              <p className="text-sm">No hay workflows bloqueados 🎉</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedWfs.map((wf) => (
                <Card key={wf.id} className="border-red-400/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link href={`/workflow-engine/${wf.id}`}>
                          <p className="text-sm font-semibold hover:text-primary">{wf.name}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{wf.product}</p>
                        <div className="mt-2 p-2 rounded-md bg-red-400/5 border border-red-400/20">
                          <p className="text-xs text-red-400">{wf.blockers}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">{stageBadge(wf.currentStage)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateWorkflowDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar workflow?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará el workflow y todo su historial de etapas permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteWf({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
