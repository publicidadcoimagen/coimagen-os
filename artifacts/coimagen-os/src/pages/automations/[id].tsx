import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAutomation, getGetAutomationQueryKey,
  useUpdateAutomation, useDeleteAutomation,
  useListAutomationLogs, getListAutomationLogsQueryKey,
  useTestAutomation,
  getListAutomationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Zap, ArrowLeft, Trash2, Play, Save, X, Edit2,
  CheckCircle2, XCircle, Clock, Info, AlertTriangle, Plus,
} from "lucide-react";
import {
  AUTOMATION_STATUSES, AUTOMATION_PRIORITIES,
  TRIGGER_TYPES, CONDITION_FIELDS,
  INTERNAL_ACTIONS, EXTERNAL_ACTIONS,
  LOG_RESULT_LABELS,
} from "./catalog";

type AutomationFull = {
  id: number; name: string; description?: string | null; status: string;
  triggerType?: string | null; trigger?: string | null;
  conditions?: string | null; actionsConfig?: string | null;
  priority: string; nextRun?: string | null; errors?: string | null;
  totalExecutions: number; executionsToday: number;
  clientId?: number | null; projectId?: number | null; agentId?: number | null;
  workflowId?: number | null; integrationId?: number | null;
  lastRun?: string | null; result?: string | null; notes?: string | null;
  createdAt: string; updatedAt?: string | null;
};

type AutomationLog = {
  id: number; automationId: number; trigger?: string | null;
  result: string; actionsExecuted?: string | null; errors?: string | null;
  durationMs?: number | null; isTest: boolean;
  userId?: string | null; clientId?: number | null; projectId?: number | null;
  createdAt: string;
};

type TestResult = {
  triggerDetected: string;
  conditionsEvaluated: string[];
  actionsThatWouldRun: string[];
  simulatedResult: string;
  notes: string;
};

export function AutomationDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const queryClient = useQueryClient();

  const [editing, setEditing]       = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Edit form state
  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [status, setStatus]         = useState("");
  const [priority, setPriority]     = useState("");
  const [triggerType, setTrigger]   = useState("");
  const [notes, setNotes]           = useState("");
  const [errors, setErrors]         = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [selectedActions, setActions] = useState<string[]>([]);
  const [newCondition, setNewCond]  = useState("");

  const { data: raw, isLoading } = useGetAutomation(id, {
    query: { queryKey: getGetAutomationQueryKey(id), enabled: id > 0 },
  });
  const automation = raw as AutomationFull | undefined;

  const { data: rawLogs = [] } = useListAutomationLogs(id, {
    query: { queryKey: getListAutomationLogsQueryKey(id), enabled: id > 0 },
  });
  const logs = rawLogs as AutomationLog[];

  const { mutate: update, isPending: saving } = useUpdateAutomation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAutomationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
        setEditing(false);
      },
    },
  });

  const { mutate: del, isPending: deleting } = useDeleteAutomation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
        window.history.back();
      },
    },
  });

  const { mutate: test, isPending: testing } = useTestAutomation({
    mutation: {
      onSuccess: (data) => {
        setTestResult(data as TestResult);
        queryClient.invalidateQueries({ queryKey: getListAutomationLogsQueryKey(id) });
      },
    },
  });

  function startEdit() {
    if (!automation) return;
    setName(automation.name);
    setDesc(automation.description ?? "");
    setStatus(automation.status);
    setPriority(automation.priority);
    setTrigger(automation.triggerType ?? "");
    setNotes(automation.notes ?? "");
    setErrors(automation.errors ?? "");
    try { setConditions(JSON.parse(automation.conditions ?? "[]")); } catch { setConditions([]); }
    try { setActions(JSON.parse(automation.actionsConfig ?? "[]")); } catch { setActions([]); }
    setEditing(true);
  }

  function saveEdit() {
    update({
      id,
      data: {
        name, description: description || undefined, status, priority,
        triggerType: triggerType || undefined,
        conditions: JSON.stringify(conditions),
        actionsConfig: JSON.stringify(selectedActions),
        notes: notes || undefined,
        errors: errors || undefined,
      },
    });
  }

  function addCondition() {
    if (newCondition.trim()) { setConditions((p) => [...p, newCondition.trim()]); setNewCond(""); }
  }
  function removeCondition(i: number) { setConditions((p) => p.filter((_, idx) => idx !== i)); }
  function toggleAction(a: string) {
    setActions((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  if (isLoading) return (
    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
  );
  if (!automation) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <p className="text-muted-foreground">Automatización no encontrada.</p>
      <Button variant="outline" size="sm" asChild><Link href="/automations"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Volver</Link></Button>
    </div>
  );

  const sm = AUTOMATION_STATUSES[automation.status] ?? AUTOMATION_STATUSES["draft"];
  const pr = AUTOMATION_PRIORITIES[automation.priority] ?? AUTOMATION_PRIORITIES["medium"];
  const triggerMeta = TRIGGER_TYPES.find((t) => t.value === automation.triggerType);

  let displayConditions: string[] = [];
  let displayActions: string[] = [];
  try { displayConditions = JSON.parse(automation.conditions ?? "[]"); } catch { displayConditions = []; }
  try { displayActions    = JSON.parse(automation.actionsConfig ?? "[]"); } catch { displayActions = []; }

  const todayLogs = logs.filter((l) => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
            <Link href="/automations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Zap className={`h-5 w-5 ${automation.status === "active" ? "text-green-400" : automation.status === "error" ? "text-red-400" : "text-primary"}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{automation.name}</h1>
              <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
              <span className={`text-[10px] font-medium ${pr.color}`}>{pr.label}</span>
            </div>
            {triggerMeta && <p className="text-sm text-muted-foreground">⚡ {triggerMeta.label}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => test({ id })} disabled={testing}>
            <Play className="h-3.5 w-3.5 mr-1.5" />{testing ? "Probando..." : "Probar"}
          </Button>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEdit}><Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 mr-1.5" />Cancelar</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}><Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Guardando..." : "Guardar"}</Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Test result banner */}
      {testResult && (
        <Card className="border-blue-400/30 bg-blue-400/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-blue-400 flex items-center gap-2"><Play className="h-3.5 w-3.5" />Resultado del modo de prueba</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-60" onClick={() => setTestResult(null)}><X className="h-3 w-3" /></Button>
            </div>
            <div className="space-y-1.5 text-xs">
              <p className="font-medium">🎯 {testResult.triggerDetected}</p>
              <div><p className="text-muted-foreground mb-1">Condiciones evaluadas:</p>{testResult.conditionsEvaluated.map((c, i) => <p key={i} className="text-green-400">{c}</p>)}</div>
              <div><p className="text-muted-foreground mb-1">Acciones que se ejecutarían:</p>{testResult.actionsThatWouldRun.map((a, i) => <p key={i} className="text-primary">{a}</p>)}</div>
              <p className="font-medium mt-1">{testResult.simulatedResult}</p>
              <p className="text-muted-foreground text-[10px]">{testResult.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total ejecuciones", value: automation.totalExecutions ?? 0, color: "text-foreground" },
          { label: "Ejecuciones hoy",   value: todayLogs.length,               color: "text-primary" },
          { label: "Logs de prueba",    value: logs.filter((l) => l.isTest).length, color: "text-blue-400" },
          { label: "Errores",           value: logs.filter((l) => l.result === "error").length, color: logs.filter((l) => l.result === "error").length > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border/40">
            <CardContent className="p-3">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="config">
        <TabsList className="h-8">
          <TabsTrigger value="config" className="text-xs">Configuración</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">Acciones</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info card */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Información</CardTitle></CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {editing ? (
                  <>
                    <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>Estado</Label>
                        <Select value={status} onValueChange={setStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(AUTOMATION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
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
                      <Label>Trigger</Label>
                      <Select value={triggerType} onValueChange={setTrigger}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
                    {automation.status === "error" && <div className="space-y-1.5"><Label>Descripción del error</Label><Textarea value={errors} onChange={(e) => setErrors(e.target.value)} rows={2} /></div>}
                  </>
                ) : (
                  <>
                    <Row label="Estado" value={sm.label} />
                    <Row label="Prioridad" value={pr.label} />
                    {triggerMeta && <Row label="Trigger" value={triggerMeta.label} />}
                    <Row label="Total ejecuciones" value={`${automation.totalExecutions ?? 0}`} />
                    <Row label="Creada" value={new Date(automation.createdAt).toLocaleDateString("es-MX")} />
                    {automation.lastRun && <Row label="Última ejecución" value={new Date(automation.lastRun).toLocaleString("es-MX")} />}
                    {automation.nextRun && <Row label="Próxima ejecución" value={new Date(automation.nextRun).toLocaleString("es-MX")} />}
                    {automation.notes && <div><p className="text-[9px] text-muted-foreground mb-0.5">Notas</p><p className="text-xs">{automation.notes}</p></div>}
                    {automation.errors && <div className="p-2 rounded bg-red-400/10 border border-red-400/20"><p className="text-[9px] text-red-400 mb-0.5">Error</p><p className="text-xs text-red-400">{automation.errors}</p></div>}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Conditions card */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Condiciones</CardTitle></CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {editing ? (
                  <>
                    <div className="flex gap-2">
                      <Select value={newCondition} onValueChange={setNewCond}>
                        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="Añadir condición..." /></SelectTrigger>
                        <SelectContent>{CONDITION_FIELDS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={addCondition} disabled={!newCondition}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    {conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-border/40">
                        <span className="text-xs flex-1">{c}</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-60" onClick={() => removeCondition(i)}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                    {conditions.length === 0 && <p className="text-[11px] text-muted-foreground">Sin condiciones — la automatización se ejecutará siempre al detectar el trigger.</p>}
                  </>
                ) : displayConditions.length > 0 ? (
                  displayConditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border border-border/40 bg-muted/10">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-xs">{c}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground py-2">Sin condiciones — se ejecuta siempre al detectar el trigger.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick status actions */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Cambios de estado rápidos</CardTitle></CardHeader>
            <CardContent className="p-4 pt-2 flex flex-wrap gap-2">
              {[
                { label: "Activar",   status: "active",   color: "border-green-400/30 text-green-400 hover:bg-green-400/10" },
                { label: "Pausar",    status: "paused",   color: "border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10" },
                { label: "Borrador",  status: "draft",    color: "border-border/40 text-muted-foreground hover:bg-muted/20" },
                { label: "Archivar",  status: "archived", color: "border-slate-400/30 text-slate-400 hover:bg-slate-400/10" },
                { label: "Error",     status: "error",    color: "border-red-400/30 text-red-400 hover:bg-red-400/10" },
              ].map(({ label, status: s, color }) => (
                <Button key={s} variant="outline" size="sm" className={`h-7 text-xs ${color}`}
                  disabled={automation.status === s}
                  onClick={() => update({ id, data: { status: s } })}>
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIONS TAB */}
        <TabsContent value="actions" className="mt-4 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Acciones internas configuradas</CardTitle></CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {editing ? (
                INTERNAL_ACTIONS.map((a) => (
                  <button key={a.value} type="button"
                    className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border transition-colors ${selectedActions.includes(a.value) ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/20"}`}
                    onClick={() => toggleAction(a.value)}>
                    <div className={`h-3.5 w-3.5 rounded border flex-shrink-0 mt-0.5 ${selectedActions.includes(a.value) ? "bg-primary border-primary" : "border-border"}`} />
                    <div>
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="text-[10px] text-muted-foreground">{a.description}</p>
                    </div>
                  </button>
                ))
              ) : displayActions.length > 0 ? (
                displayActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-xs">→ {a}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin acciones configuradas. Edita la automatización para agregar acciones.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs text-muted-foreground">Acciones externas (próximamente)</CardTitle>
                <Badge variant="outline" className="text-[9px]">Requieren credenciales</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {EXTERNAL_ACTIONS.map((a) => (
                <div key={a.value} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/30 opacity-60">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">Requiere: {a.requiresIntegration}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] py-0">Pendiente</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sin logs de ejecución</p>
              <p className="text-xs">Usa el botón "Probar" para generar el primer log</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => {
                const rm = LOG_RESULT_LABELS[log.result] ?? LOG_RESULT_LABELS["success"];
                let actions: string[] = [];
                try { actions = JSON.parse(log.actionsExecuted ?? "[]"); } catch { actions = []; }
                return (
                  <Card key={log.id} className="border-border/40">
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${rm.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-medium">{rm.label}</p>
                          {log.isTest && <Badge variant="outline" className="text-[9px] py-0 bg-blue-400/10 text-blue-400 border-blue-400/30">Test</Badge>}
                          {log.trigger && <span className="text-[10px] text-muted-foreground">⚡ {log.trigger}</span>}
                        </div>
                        {actions.length > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{actions.join(", ")}</p>}
                        {log.errors && <p className="text-[10px] text-red-400 mt-0.5">{log.errors}</p>}
                        {log.durationMs && <p className="text-[10px] text-muted-foreground">{log.durationMs}ms</p>}
                      </div>
                      <span className="text-[9px] text-muted-foreground flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString("es-MX")}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!o) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminarán también todos los logs de ejecución. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => del({ id })} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
