import { useState } from "react";
import {
  useListAiExecutions, getListAiExecutionsQueryKey,
  useCreateAiExecution,
  useRunAiExecution,
  useDeleteAiExecution,
  useListAgents,
  useListMundos,
  useListDirectors,
  useListClients,
  useListProjects,
  useListWorkflows,
  useListAutomations,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  PlayCircle, Plus, Bot, Globe2, User, Trash2,
  CheckCircle2, XCircle, FlaskConical, ArrowUpRight,
  Clock, AlertTriangle, Send,
} from "lucide-react";
import { Link } from "wouter";

type Exec = {
  id: number; status: string; result: string; isSimulated: boolean;
  sentToQc: boolean; agentName?: string | null; mundoName?: string | null;
  directorName?: string | null; clientId?: number | null; projectId?: number | null;
  workflowId?: number | null; automationId?: number | null;
  prompt?: string | null; inputData?: string | null; outputData?: string | null;
  errors?: string | null; durationMs?: number | null; createdAt: string;
};

const RESULT_COLORS: Record<string, string> = {
  success:   "bg-green-500/10 text-green-400 border-green-500/20",
  error:     "bg-red-500/10 text-red-400 border-red-500/20",
  simulated: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const RESULT_LABELS: Record<string, string> = {
  success: "Éxito", error: "Error", simulated: "Simulada",
};
const STATUS_COLORS: Record<string, string> = {
  completed:  "bg-green-500/10 text-green-400 border-green-500/20",
  failed:     "bg-red-500/10 text-red-400 border-red-500/20",
  running:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pending:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cancelled:  "bg-muted/50 text-muted-foreground border-border",
};

export function AiExecutionHub() {
  const qc = useQueryClient();
  const { data: rawExecs = [] } = useListAiExecutions({ query: { queryKey: getListAiExecutionsQueryKey() } });
  const executions = rawExecs as Exec[];

  const { data: rawAgents = [] }   = useListAgents();
  const { data: rawMundos = [] }   = useListMundos();
  const { data: rawDirectors = [] } = useListDirectors();
  const { data: rawClients = [] }  = useListClients();
  const { data: rawProjects = [] } = useListProjects();
  const { data: rawWorkflows = [] } = useListWorkflows();
  const { data: rawAutos = [] }    = useListAutomations();

  const agents    = rawAgents    as { id: number; name: string }[];
  const mundos    = rawMundos    as { id: number; name: string }[];
  const directors = rawDirectors as { id: number; name: string }[];
  const clients   = rawClients   as { id: number; name: string }[];
  const projects  = rawProjects  as { id: number; name: string }[];
  const workflows = rawWorkflows as { id: number; name: string }[];
  const autos     = rawAutos     as { id: number; name: string }[];

  const createMut  = useCreateAiExecution();
  const runMut     = useRunAiExecution();
  const deleteMut  = useDeleteAiExecution();

  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter]         = useState<string>("all");
  const [runningId, setRunningId]   = useState<number | null>(null);
  const [form, setForm] = useState({
    agentId: "", agentName: "", mundoId: "", mundoName: "",
    directorId: "", directorName: "", clientId: "", projectId: "",
    workflowId: "", automationId: "", prompt: "", inputData: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAiExecutionsQueryKey() });

  const filtered = filter === "all"
    ? executions
    : filter === "error"   ? executions.filter((e) => e.result === "error")
    : filter === "success" ? executions.filter((e) => e.result === "success")
    : filter === "simulated" ? executions.filter((e) => e.isSimulated)
    : filter === "qc"      ? executions.filter((e) => e.sentToQc)
    : executions;

  const stats = [
    { label: "Total",        value: executions.length,                                       color: "text-foreground" },
    { label: "Completadas",  value: executions.filter((e) => e.status === "completed").length, color: "text-green-400" },
    { label: "Fallidas",     value: executions.filter((e) => e.result === "error").length,    color: "text-red-400" },
    { label: "Simuladas",    value: executions.filter((e) => e.isSimulated).length,           color: "text-amber-400" },
    { label: "En QC",        value: executions.filter((e) => e.sentToQc).length,             color: "text-purple-400" },
  ];

  function handleCreate() {
    const agentId    = form.agentId    ? parseInt(form.agentId)    : undefined;
    const mundoId    = form.mundoId    ? parseInt(form.mundoId)    : undefined;
    const directorId = form.directorId ? parseInt(form.directorId) : undefined;
    const clientId   = form.clientId   ? parseInt(form.clientId)   : undefined;
    const projectId  = form.projectId  ? parseInt(form.projectId)  : undefined;
    const workflowId = form.workflowId ? parseInt(form.workflowId) : undefined;
    const automationId = form.automationId ? parseInt(form.automationId) : undefined;

    const agentSel    = agents.find((a) => a.id === agentId);
    const mundoSel    = mundos.find((m) => m.id === mundoId);
    const directorSel = directors.find((d) => d.id === directorId);

    createMut.mutate({ data: {
      agentId,
      agentName:    (agentSel?.name    ?? form.agentName)    || undefined,
      mundoId,
      mundoName:    (mundoSel?.name    ?? form.mundoName)    || undefined,
      directorId,
      directorName: (directorSel?.name ?? form.directorName) || undefined,
      clientId, projectId, workflowId, automationId,
      prompt:    form.prompt    || undefined,
      inputData: form.inputData || undefined,
      status:    "completed",
      result:    "simulated",
      isSimulated: true,
    }}, {
      onSuccess: () => { invalidate(); setShowCreate(false); setForm({ agentId: "", agentName: "", mundoId: "", mundoName: "", directorId: "", directorName: "", clientId: "", projectId: "", workflowId: "", automationId: "", prompt: "", inputData: "" }); },
    });
  }

  function handleRun(id: number) {
    setRunningId(id);
    runMut.mutate({ id }, {
      onSuccess:  () => { invalidate(); setRunningId(null); },
      onError:    () => setRunningId(null),
    });
  }

  function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta ejecución?")) return;
    deleteMut.mutate({ id }, { onSuccess: invalidate });
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-primary" />
            AI Execution Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Motor de ejecución y trazabilidad de agentes IA</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva ejecución
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {stats.map(({ label, value, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all",       label: "Todas" },
          { key: "success",   label: "Exitosas" },
          { key: "error",     label: "Con error" },
          { key: "simulated", label: "Simuladas" },
          { key: "qc",        label: "En Quality Center" },
        ].map(({ key, label }) => (
          <Button key={key} variant={filter === key ? "default" : "outline"} size="sm"
            onClick={() => setFilter(key)}>
            {label}
          </Button>
        ))}
      </div>

      {/* Execution list */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm text-muted-foreground">
            {filtered.length} ejecuciones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay ejecuciones registradas.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((exec) => (
                <div key={exec.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Agent */}
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                          {exec.agentName ?? "Sin agente"}
                        </span>
                        {exec.mundoName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe2 className="h-3 w-3" />
                            {exec.mundoName}
                          </span>
                        )}
                        {exec.directorName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {exec.directorName}
                          </span>
                        )}
                        <Badge variant="outline" className={`text-[9px] px-1.5 ${RESULT_COLORS[exec.result] ?? ""}`}>
                          {RESULT_LABELS[exec.result] ?? exec.result}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] px-1.5 ${STATUS_COLORS[exec.status] ?? ""}`}>
                          {exec.status}
                        </Badge>
                        {exec.isSimulated && (
                          <Badge variant="outline" className="text-[9px] px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                            <FlaskConical className="h-2.5 w-2.5 mr-1" />simulada
                          </Badge>
                        )}
                        {exec.sentToQc && (
                          <Badge variant="outline" className="text-[9px] px-1.5 bg-purple-500/10 text-purple-400 border-purple-500/20">
                            <Send className="h-2.5 w-2.5 mr-1" />en QC
                          </Badge>
                        )}
                      </div>
                      {exec.prompt && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">
                          <span className="font-medium">Prompt:</span> {exec.prompt}
                        </p>
                      )}
                      {exec.errors && (
                        <p className="text-xs text-red-400 mt-1 truncate max-w-xl">
                          <AlertTriangle className="inline h-3 w-3 mr-1" />{exec.errors}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{fmtDate(exec.createdAt)}
                        </span>
                        {exec.durationMs != null && (
                          <span>{exec.durationMs}ms</span>
                        )}
                        {exec.clientId && <span>Cliente #{exec.clientId}</span>}
                        {exec.projectId && <span>Proyecto #{exec.projectId}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => handleRun(exec.id)}
                        disabled={runningId === exec.id}>
                        <PlayCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/executions/${exec.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(exec.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-primary" />
              Nueva Ejecución de Agente IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Separator />
            <p className="text-xs text-muted-foreground">CONTEXTO DEL AGENTE</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Agente</Label>
                {agents.length > 0 ? (
                  <Select value={form.agentId} onValueChange={(v) => setForm((f) => ({ ...f, agentId: v, agentName: agents.find((a) => a.id === parseInt(v))?.name ?? "" }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar agente" /></SelectTrigger>
                    <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="h-8 text-xs" placeholder="Nombre del agente" value={form.agentName}
                    onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mundo</Label>
                {mundos.length > 0 ? (
                  <Select value={form.mundoId} onValueChange={(v) => setForm((f) => ({ ...f, mundoId: v, mundoName: mundos.find((m) => m.id === parseInt(v))?.name ?? "" }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar mundo" /></SelectTrigger>
                    <SelectContent>{mundos.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="h-8 text-xs" placeholder="Nombre del mundo" value={form.mundoName}
                    onChange={(e) => setForm((f) => ({ ...f, mundoName: e.target.value }))} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Director</Label>
                {directors.length > 0 ? (
                  <Select value={form.directorId} onValueChange={(v) => setForm((f) => ({ ...f, directorId: v, directorName: directors.find((d) => d.id === parseInt(v))?.name ?? "" }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar director" /></SelectTrigger>
                    <SelectContent>{directors.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="h-8 text-xs" placeholder="Nombre del director" value={form.directorName}
                    onChange={(e) => setForm((f) => ({ ...f, directorName: e.target.value }))} />
                )}
              </div>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">CONTEXTO RELACIONAL (OPCIONAL)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin cliente</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Proyecto</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin proyecto</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Workflow</Label>
                <Select value={form.workflowId} onValueChange={(v) => setForm((f) => ({ ...f, workflowId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin workflow" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin workflow</SelectItem>
                    {workflows.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Automatización</Label>
                <Select value={form.automationId} onValueChange={(v) => setForm((f) => ({ ...f, automationId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin automatización" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin automatización</SelectItem>
                    {autos.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">DATOS DE EJECUCIÓN</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prompt</Label>
                <Textarea className="text-xs min-h-[80px]" placeholder="Describe la tarea o instrucción del agente..."
                  value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Datos de entrada (JSON opcional)</Label>
                <Textarea className="text-xs min-h-[60px] font-mono" placeholder='{"key": "value"}'
                  value={form.inputData} onChange={(e) => setForm((f) => ({ ...f, inputData: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? "Creando..." : "Crear ejecución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
