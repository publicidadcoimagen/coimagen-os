import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkflow,
  getGetWorkflowQueryKey,
  getListWorkflowsQueryKey,
  useUpdateWorkflow,
  useAdvanceWorkflow,
  useGetWorkflowStageLogs,
  getGetWorkflowStageLogsQueryKey,
  useListClients,
  getListClientsQueryKey,
  useListProjects,
  getListProjectsQueryKey,
  useListAgents,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  GitBranch, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2,
  ArrowRight, Clock, User, Bot, Calendar, Edit2, History, Info,
} from "lucide-react";

// ─── Constants (re-used from list) ────────────────────────────────────────────
const ALL_STAGES = [
  "lead_received","diagnosis_started","diagnosis_completed","proposal_sent",
  "proposal_approved","contract_sent","contract_signed","payment_received",
  "onboarding_started","onboarding_completed","production_started","design_review",
  "development_review","qa_internal","changes_requested","client_approval",
  "final_delivery","monthly_active","support_active","customer_success",
];

const STAGE_LABELS: Record<string, string> = {
  lead_received:        "Lead recibido",
  diagnosis_started:    "Diagnóstico iniciado",
  diagnosis_completed:  "Diagnóstico completado",
  proposal_sent:        "Propuesta enviada",
  proposal_approved:    "Propuesta aprobada",
  contract_sent:        "Contrato enviado",
  contract_signed:      "Contrato firmado",
  payment_received:     "Pago inicial recibido",
  onboarding_started:   "Onboarding iniciado",
  onboarding_completed: "Onboarding completado",
  production_started:   "Producción iniciada",
  design_review:        "Diseño en revisión",
  development_review:   "Desarrollo en revisión",
  qa_internal:          "QA interno",
  changes_requested:    "Cambios solicitados",
  client_approval:      "Aprobación cliente",
  final_delivery:       "Entrega final",
  monthly_active:       "Mensualidad activa",
  support_active:       "Soporte activo",
  customer_success:     "Customer Success",
};

const STAGE_COLORS: Record<string, string> = {
  lead_received: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  diagnosis_started: "bg-blue-400/20 text-blue-300 border-blue-400/30",
  diagnosis_completed: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  proposal_sent: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
  proposal_approved: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  contract_sent: "bg-orange-400/20 text-orange-300 border-orange-400/30",
  contract_signed: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  payment_received: "bg-green-400/20 text-green-300 border-green-400/30",
  onboarding_started: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
  onboarding_completed: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
  production_started: "bg-purple-400/20 text-purple-300 border-purple-400/30",
  design_review: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  development_review: "bg-violet-400/20 text-violet-300 border-violet-400/30",
  qa_internal: "bg-indigo-400/20 text-indigo-300 border-indigo-400/30",
  changes_requested: "bg-red-400/20 text-red-300 border-red-400/30",
  client_approval: "bg-teal-400/20 text-teal-300 border-teal-400/30",
  final_delivery: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
  monthly_active: "bg-green-500/20 text-green-300 border-green-400/30",
  support_active: "bg-green-600/20 text-green-300 border-green-400/30",
  customer_success: "bg-amber-400/20 text-amber-300 border-amber-400/30",
};

const PRODUCTS = [
  "AI Website","SEO Growth","Google Business","AI Automation",
  "Camila AI","COIMAGEN OS","Medical OS","Restaurant OS",
  "Law OS","Real Estate OS","Cloud Systems","Consultoría",
];

type WF = {
  id: number; name: string; description?: string | null; product?: string | null;
  clientId?: number | null; projectId?: number | null; status: string;
  currentStage: string; progress: number; priority: string; responsibleId?: string | null;
  agentIds?: number[] | null; blockers?: string | null; notes?: string | null;
  startDate?: string | null; targetDate?: string | null; templateId?: number | null;
  createdAt: string; updatedAt?: string | null;
};

type StageLog = {
  id: number; workflowId: number; fromStage?: string | null;
  toStage: string; note?: string | null; userId?: string | null; createdAt: string;
};

// ─── Advance Stage Dialog ──────────────────────────────────────────────────────
function AdvanceDialog({ wf, open, onClose }: { wf: WF; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const currentIdx = ALL_STAGES.indexOf(wf.currentStage);
  const nextStage = currentIdx < ALL_STAGES.length - 1 ? ALL_STAGES[currentIdx + 1] : null;
  const [targetStage, setTargetStage] = useState(nextStage ?? "");
  const [note, setNote] = useState("");

  const { mutate: advance, isPending } = useAdvanceWorkflow({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkflowQueryKey(wf.id) });
        queryClient.invalidateQueries({ queryKey: getGetWorkflowStageLogsQueryKey(wf.id) });
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey({}) });
        onClose();
        setNote("");
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Avanzar etapa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Etapa destino</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STAGES.map((s, i) => (
                  <SelectItem key={s} value={s} disabled={i <= currentIdx}>
                    {STAGE_LABELS[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Descripción del cambio de etapa..." rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => advance({ id: wf.id, data: { stage: targetStage, note: note || undefined } })} disabled={!targetStage || isPending}>
              {isPending ? "Avanzando..." : "Confirmar avance"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
function EditDialog({ wf, open, onClose }: { wf: WF; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(wf.name);
  const [description, setDescription] = useState(wf.description ?? "");
  const [product, setProduct] = useState(wf.product ?? "");
  const [priority, setPriority] = useState(wf.priority);
  const [status, setStatus] = useState(wf.status);
  const [startDate, setStartDate] = useState(wf.startDate ?? "");
  const [targetDate, setTargetDate] = useState(wf.targetDate ?? "");
  const [notes, setNotes] = useState(wf.notes ?? "");
  const [blockers, setBlockers] = useState(wf.blockers ?? "");
  const [agentIds, setAgentIds] = useState<number[]>(wf.agentIds ?? []);

  const { data: agents = [] } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });

  const { mutate: updateWf, isPending } = useUpdateWorkflow({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkflowQueryKey(wf.id) });
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey({}) });
        onClose();
      },
    },
  });

  const handleSave = () => {
    updateWf({ id: wf.id, data: {
      name, description: description || undefined, product: product || undefined,
      priority, status, startDate: startDate || undefined, targetDate: targetDate || undefined,
      notes: notes || undefined, blockers: blockers || undefined,
      agentIds: agentIds.length > 0 ? agentIds : undefined,
    }});
  };

  const toggleAgent = (id: number) => {
    setAgentIds((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Workflow</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent><SelectItem value="">—</SelectItem>{PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
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
            <div className="space-y-1.5"><Label>Fecha inicio</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fecha objetivo</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Bloqueos</Label><Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} placeholder="Describir qué está bloqueando este workflow..." /></div>
          </div>
          <div className="space-y-2">
            <Label>Agentes asignados</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(agents as { id: number; name: string; role: string }[]).map((agent) => {
                const active = agentIds.includes(agent.id);
                return (
                  <button key={agent.id} onClick={() => toggleAgent(agent.id)} className={`text-left p-2 rounded border text-xs transition-all ${active ? "border-primary/50 bg-primary/10" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                    <p className="font-medium truncate">{agent.name}</p>
                    <p className="text-[10px] opacity-60 truncate">{agent.role}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim() || isPending}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────
export function WorkflowDetail() {
  const [, params] = useRoute("/workflow-engine/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: rawWf, isLoading } = useGetWorkflow(id, {
    query: { queryKey: getGetWorkflowQueryKey(id), enabled: id > 0 },
  });

  const { data: rawLogs = [] } = useGetWorkflowStageLogs(id, {
    query: { queryKey: getGetWorkflowStageLogsQueryKey(id), enabled: id > 0 },
  });

  const { data: clients = [] } = useListClients({ query: { queryKey: getListClientsQueryKey() } });
  const { data: projects = [] } = useListProjects({}, { query: { queryKey: getListProjectsQueryKey() } });

  const wf = rawWf as WF | undefined;
  const logs = rawLogs as StageLog[];
  const allClients = clients as { id: number; name: string }[];
  const allProjects = projects as { id: number; name: string }[];

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground animate-pulse">Cargando workflow...</p>
    </div>
  );

  if (!wf) return (
    <div className="flex flex-col items-center gap-3 min-h-[60vh] justify-center">
      <GitBranch className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Workflow no encontrado</p>
      <Button variant="outline" size="sm" asChild><Link href="/workflow-engine"><ArrowLeft className="h-4 w-4 mr-1.5" />Volver</Link></Button>
    </div>
  );

  const currentIdx = ALL_STAGES.indexOf(wf.currentStage);
  const stageColor = STAGE_COLORS[wf.currentStage] ?? "bg-muted text-muted-foreground border-border/50";
  const client = allClients.find((c) => c.id === wf.clientId);
  const project = allProjects.find((p) => p.id === wf.projectId);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/workflow-engine" className="hover:text-foreground flex items-center gap-1">
          <GitBranch className="h-3 w-3" />Workflows
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate">{wf.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{wf.name}</h1>
            <Badge variant="outline" className={`text-[10px] ${stageColor}`}>{STAGE_LABELS[wf.currentStage] ?? wf.currentStage}</Badge>
            {wf.status === "completed" && <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">Completado</Badge>}
            {wf.blockers && <Badge variant="outline" className="text-[10px] bg-red-400/15 text-red-400 border-red-400/30"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Bloqueado</Badge>}
          </div>
          {wf.product && <p className="text-sm text-muted-foreground">{wf.product}</p>}
          <div className="flex items-center gap-2">
            <Progress value={wf.progress} className="h-2 flex-1 max-w-[300px]" />
            <span className="text-xs text-muted-foreground">{wf.progress}% — Etapa {currentIdx + 1} / {ALL_STAGES.length}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar
          </Button>
          {wf.status !== "completed" && (
            <Button size="sm" onClick={() => setAdvanceOpen(true)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />Avanzar etapa
            </Button>
          )}
        </div>
      </div>

      {/* Stage Timeline */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Pipeline de etapas</p>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-0 min-w-max">
              {ALL_STAGES.map((stage, i) => {
                const isDone = i < currentIdx;
                const isActive = i === currentIdx;
                const color = STAGE_COLORS[stage] ?? "";
                return (
                  <div key={stage} className="flex items-center">
                    <div className={`px-2 py-1 rounded text-[9px] font-medium border transition-all ${
                      isDone ? "bg-primary/20 text-primary border-primary/30 opacity-70" :
                      isActive ? `${color} ring-1 ring-primary/50` :
                      "bg-muted/20 text-muted-foreground/40 border-border/20"
                    }`}>
                      {isDone ? "✓ " : ""}{STAGE_LABELS[stage] ?? stage}
                    </div>
                    {i < ALL_STAGES.length - 1 && <ChevronRight className={`h-3 w-3 flex-shrink-0 ${isDone ? "text-primary/30" : "text-muted-foreground/20"}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info + Tabs */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left: Info cards */}
        <div className="col-span-1 space-y-3">
          <Card className="border-border/50">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Detalles</p>
              {[
                { icon: Clock, label: "Prioridad", value: wf.priority },
                { icon: Info, label: "Estado", value: wf.status },
                { icon: Calendar, label: "Inicio", value: wf.startDate ?? "—" },
                { icon: Calendar, label: "Objetivo", value: wf.targetDate ?? "—" },
                { icon: User, label: "Cliente", value: client?.name ?? (wf.clientId ? `#${wf.clientId}` : "—") },
                { icon: GitBranch, label: "Proyecto", value: project?.name ?? (wf.projectId ? `#${wf.projectId}` : "—") },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}:</span>
                  <span className="text-xs truncate">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {wf.agentIds && wf.agentIds.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Agentes</p>
                <div className="space-y-1">
                  {wf.agentIds.map((aid) => (
                    <div key={aid} className="flex items-center gap-1.5 text-xs">
                      <Bot className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-muted-foreground">Agente #{aid}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {wf.blockers && (
            <Card className="border-red-400/30">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />Bloqueo activo
                </p>
                <p className="text-xs text-muted-foreground">{wf.blockers}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="col-span-2">
          <Tabs defaultValue="history">
            <TabsList className="h-8">
              <TabsTrigger value="history" className="text-xs gap-1.5"><History className="h-3 w-3" />Historial</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1.5"><Info className="h-3 w-3" />Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-3">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Sin historial de etapas</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${i === 0 ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                          {i === 0 ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <div className="h-1.5 w-1.5 rounded-full bg-border" />}
                        </div>
                        {i < logs.length - 1 && <div className="w-0.5 flex-1 bg-border/50 my-1" />}
                      </div>
                      <div className="pb-3 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {log.fromStage && (
                            <>
                              <span className="text-[10px] text-muted-foreground">{STAGE_LABELS[log.fromStage] ?? log.fromStage}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                            </>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STAGE_COLORS[log.toStage] ?? "bg-muted text-muted-foreground border-border/50"}`}>
                            {STAGE_LABELS[log.toStage] ?? log.toStage}
                          </span>
                        </div>
                        {log.note && <p className="text-xs text-muted-foreground mt-0.5">{log.note}</p>}
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {new Date(log.createdAt).toLocaleString("es-MX")}
                          {log.userId && ` · ${log.userId}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-3">
              <div className="space-y-3">
                {wf.description && (
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm">{wf.description}</p>
                  </div>
                )}
                {wf.notes && (
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{wf.notes}</p>
                  </div>
                )}
                {!wf.description && !wf.notes && (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sin descripción ni notas</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {wf && <AdvanceDialog wf={wf} open={advanceOpen} onClose={() => setAdvanceOpen(false)} />}
      {wf && <EditDialog wf={wf} open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
