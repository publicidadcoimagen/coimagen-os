import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetAiExecution, getGetAiExecutionQueryKey,
  useUpdateAiExecution,
  useRunAiExecution,
  useSendExecutionToQc,
  useDeleteAiExecution,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  PlayCircle, Bot, Globe2, User, Clock, AlertTriangle,
  CheckCircle2, XCircle, FlaskConical, Send, Trash2,
  ArrowLeft, FileText, Shield, RefreshCw, Link2,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type Exec = {
  id: number; status: string; result: string; isSimulated: boolean; sentToQc: boolean;
  agentId?: number | null; agentName?: string | null;
  mundoId?: number | null; mundoName?: string | null;
  directorId?: number | null; directorName?: string | null;
  clientId?: number | null; projectId?: number | null;
  workflowId?: number | null; automationId?: number | null;
  prompt?: string | null; inputData?: string | null; outputData?: string | null;
  errors?: string | null; durationMs?: number | null;
  qcIncidentId?: number | null; notes?: string | null; createdAt: string; updatedAt?: string | null;
};

const RESULT_COLORS: Record<string, string> = {
  success:   "bg-green-500/10 text-green-400 border-green-500/20",
  error:     "bg-red-500/10 text-red-400 border-red-500/20",
  simulated: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const RESULT_LABELS: Record<string, string> = { success: "Éxito", error: "Error", simulated: "Simulada" };
const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  failed:    "bg-red-500/10 text-red-400 border-red-500/20",
  running:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pending:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function tryJson(s?: string | null) {
  if (!s) return null;
  try { return JSON.stringify(JSON.parse(s), null, 2); }
  catch { return s; }
}

type Tab = "overview" | "io" | "qc";

export function AiExecutionDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes]   = useState<string>("");
  const [running, setRunning] = useState(false);
  const [sendingQc, setSendingQc] = useState(false);

  const { data: raw, isLoading } = useGetAiExecution(numId, {
    query: { queryKey: getGetAiExecutionQueryKey(numId) },
  });
  const exec = raw as Exec | undefined;

  const updateMut = useUpdateAiExecution();
  const runMut    = useRunAiExecution();
  const qcMut     = useSendExecutionToQc();
  const deleteMut = useDeleteAiExecution();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetAiExecutionQueryKey(numId) });

  function handleRun() {
    setRunning(true);
    runMut.mutate({ id: numId }, {
      onSuccess: () => { invalidate(); setRunning(false); setTab("io"); },
      onError:   () => setRunning(false),
    });
  }

  function handleSendQc() {
    setSendingQc(true);
    qcMut.mutate({ id: numId }, {
      onSuccess: () => { invalidate(); setSendingQc(false); setTab("qc"); },
      onError:   () => setSendingQc(false),
    });
  }

  function handleSaveNotes() {
    updateMut.mutate({ id: numId, data: { notes } }, { onSuccess: invalidate });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar esta ejecución permanentemente?")) return;
    deleteMut.mutate({ id: numId }, { onSuccess: () => navigate("/executions") });
  }

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Cargando...</div>;
  if (!exec)     return <div className="p-6 text-muted-foreground text-sm">Ejecución no encontrada.</div>;

  const parsedOutput = tryJson(exec.outputData);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/executions">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" />
                Ejecución #{exec.id}
              </h1>
              <Badge variant="outline" className={`text-[10px] ${RESULT_COLORS[exec.result] ?? ""}`}>
                {RESULT_LABELS[exec.result] ?? exec.result}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[exec.status] ?? ""}`}>
                {exec.status}
              </Badge>
              {exec.isSimulated && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                  <FlaskConical className="h-2.5 w-2.5 mr-1" />simulada
                </Badge>
              )}
              {exec.sentToQc && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                  <Shield className="h-2.5 w-2.5 mr-1" />en QC
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDate(exec.createdAt)}
              {exec.durationMs != null && <span className="ml-2">{exec.durationMs}ms</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRun} disabled={running}>
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {running ? "Ejecutando..." : "Simular"}
          </Button>
          {exec.result === "error" && !exec.sentToQc && (
            <Button variant="outline" size="sm" className="gap-2 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
              onClick={handleSendQc} disabled={sendingQc}>
              <Send className="h-3.5 w-3.5" />
              {sendingQc ? "Enviando..." : "Enviar a QC"}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: "overview", label: "Resumen",        icon: Bot },
          { key: "io",       label: "Prompt / E·S",   icon: FileText },
          { key: "qc",       label: "Quality Center",  icon: Shield },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-muted-foreground">AGENTE</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Row icon={<Bot className="h-3.5 w-3.5 text-primary" />}   label="Agente"   value={exec.agentName} />
              <Row icon={<Globe2 className="h-3.5 w-3.5 text-primary" />} label="Mundo"   value={exec.mundoName} />
              <Row icon={<User className="h-3.5 w-3.5 text-primary" />}   label="Director" value={exec.directorName} />
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-muted-foreground">CONTEXTO RELACIONAL</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Row label="Cliente"       value={exec.clientId   ? `#${exec.clientId}`   : null} />
              <Row label="Proyecto"      value={exec.projectId  ? `#${exec.projectId}`  : null} />
              <Row label="Workflow"      value={exec.workflowId ? `#${exec.workflowId}` : null} />
              <Row label="Automatización" value={exec.automationId ? `#${exec.automationId}` : null} />
            </CardContent>
          </Card>
          <Card className="border-border/50 col-span-2">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-muted-foreground">NOTAS</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Textarea className="text-xs min-h-[80px]" placeholder="Agrega notas sobre esta ejecución..."
                defaultValue={exec.notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
              <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={updateMut.isPending}>
                Guardar notas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Prompt / E·S */}
      {tab === "io" && (
        <div className="space-y-4">
          {exec.prompt && (
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs text-muted-foreground">PROMPT</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm whitespace-pre-wrap">{exec.prompt}</p>
              </CardContent>
            </Card>
          )}
          {exec.inputData && (
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs text-muted-foreground">DATOS DE ENTRADA</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <pre className="text-xs font-mono bg-muted/30 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{tryJson(exec.inputData)}</pre>
              </CardContent>
            </Card>
          )}
          {exec.outputData && (
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs text-muted-foreground">SALIDA</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <pre className="text-xs font-mono bg-muted/30 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{parsedOutput}</pre>
              </CardContent>
            </Card>
          )}
          {!exec.prompt && !exec.inputData && !exec.outputData && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay datos de prompt o E/S registrados.
              <br />Usa el botón <span className="font-medium">Simular</span> para generar una salida.
            </div>
          )}
          {exec.errors && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />ERROR
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">{exec.errors}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Quality Center */}
      {tab === "qc" && (
        <div className="space-y-4">
          {exec.sentToQc ? (
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Shield className="h-5 w-5" />
                  <span className="font-semibold">Reportado al Quality Center</span>
                </div>
                {exec.qcIncidentId && (
                  <p className="text-sm text-muted-foreground">
                    Incidente creado:{" "}
                    <Link href={`/quality-center/incidents/${exec.qcIncidentId}`}>
                      <span className="text-purple-400 hover:underline cursor-pointer flex items-center gap-1 inline-flex">
                        #QC-{exec.qcIncidentId} <Link2 className="h-3 w-3" />
                      </span>
                    </Link>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Este fallo fue registrado como incidente de alta prioridad en el Quality Center.
                  El equipo técnico puede visualizarlo y crear tickets de solución desde allí.
                </p>
              </CardContent>
            </Card>
          ) : exec.result === "error" ? (
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">Ejecución fallida — no reportada</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta ejecución terminó con error. Puedes enviarla al Quality Center para
                  crear un incidente de alta prioridad y darle seguimiento.
                </p>
                {exec.errors && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3">
                    <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{exec.errors}</p>
                  </div>
                )}
                <Button className="gap-2 bg-purple-600 hover:bg-purple-700"
                  onClick={handleSendQc} disabled={sendingQc}>
                  <Send className="h-4 w-4" />
                  {sendingQc ? "Enviando a Quality Center..." : "Enviar a Quality Center"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-400 opacity-50" />
              Esta ejecución no presenta errores.<br />
              Solo las ejecuciones fallidas pueden enviarse al Quality Center.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="text-muted-foreground text-xs w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value ?? <span className="text-muted-foreground text-xs">—</span>}</span>
    </div>
  );
}
