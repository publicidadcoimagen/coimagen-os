import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDiagnoses,
  useCreateDiagnosis,
  useUpdateDiagnosis,
  useGetProspect,
  getGetProspectQueryKey,
  getListDiagnosesQueryKey,
  type Diagnosis,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Stethoscope, ExternalLink, User } from "lucide-react";
import { formatDate } from "@/lib/format";

const STATUS_ES: Record<string, string> = {
  draft: "Borrador", pending_approval: "Pendiente Aprobación", approved: "Aprobado",
  rejected: "Rechazado", executed: "Ejecutado", archived: "Archivado", completed: "Completado",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", pending_approval: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  executed: "bg-violet-500/20 text-violet-300 border-violet-500/30", archived: "bg-muted/50 text-muted-foreground/60",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const STATUSES = ["draft", "pending_approval", "approved", "rejected", "executed", "archived"];

// Public results page lives on coimagen-media-web, not in this dashboard.
const PUBLIC_RESULTS_BASE_URL = "https://www.coimagenmedia.com/diagnostico/resultado";

const PROVIDER_LABEL: Record<string, string> = { anthropic: "Anthropic (Claude)", google: "Google (Gemini)" };

const PRIORITY_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

function getScoreTier(score: number) {
  if (score < 40) return { label: "Crítico", color: "text-red-400" };
  if (score < 60) return { label: "Necesita atención", color: "text-orange-400" };
  if (score < 75) return { label: "En progreso", color: "text-amber-400" };
  if (score < 90) return { label: "Bien encaminado", color: "text-emerald-400" };
  return { label: "Excelente", color: "text-cyan-400" };
}

// Shape of `diagnoses.result` for type === "digital_diagnosis" rows, written
// by the Digital Diagnosis Agent (see api-server/lib/digital-diagnosis).
// The generated API client types `result` as a generic JSON blob, so this
// mirrors coimagen-media-web/src/lib/diagnosisApi.ts's DigitalDiagnosisAnalysis.
interface DigitalDiagnosisAnalysis {
  overallScore: number;
  summary: string;
  prioritizedTasks: { priority: "high" | "medium" | "low"; title: string; description: string }[];
  _meta?: { aiProvider?: string };
}

export function Diagnosis() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const { data: diagnoses, isLoading } = useListDiagnoses({}, { query: { queryKey: getListDiagnosesQueryKey() } });
  const createDiagnosis = useCreateDiagnosis();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", type: "diagnosis", status: "draft" });
  const [selected, setSelected] = useState<Diagnosis | null>(null);

  const filtered = diagnoses?.filter((d) => filterStatus === "all" || d.status === filterStatus) ?? [];

  const handleSubmit = () => {
    if (!form.title) return;
    createDiagnosis.mutate({ data: { title: form.title, content: form.content || undefined, type: form.type, status: form.status as "draft" } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListDiagnosesQueryKey() }); setOpen(false); setForm({ title: "", content: "", type: "diagnosis", status: "draft" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Diagnósticos Digitales</h1>
          <Badge variant="outline">{filtered.length}</Badge>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Diagnóstico
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)} className="text-xs h-7">
            {s === "all" ? "Todos" : STATUS_ES[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} onClick={() => setSelected(d)} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{d.type}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[d.status]}`}>{STATUS_ES[d.status] ?? d.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin diagnósticos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Diagnóstico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="diagnosis" /></div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_ES[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Contenido</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Describe los hallazgos del diagnóstico..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title || createDiagnosis.isPending}>{createDiagnosis.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiagnosisDetailDialog diagnosis={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function DiagnosisDetailDialog({ diagnosis, onClose }: { diagnosis: Diagnosis | null; onClose: () => void }) {
  const prospectId = diagnosis?.prospectId ?? undefined;
  const { data: prospect } = useGetProspect(prospectId ?? 0, {
    query: { queryKey: getGetProspectQueryKey(prospectId ?? 0), enabled: !!prospectId },
  });

  if (!diagnosis) return null;

  const analysis = diagnosis.type === "digital_diagnosis" && diagnosis.result
    ? (diagnosis.result as unknown as DigitalDiagnosisAnalysis)
    : null;
  const provider = analysis?._meta?.aiProvider;
  const sortedTasks = analysis
    ? [...analysis.prioritizedTasks].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      })
    : [];
  const tier = analysis ? getScoreTier(analysis.overallScore) : null;

  return (
    <Dialog open={!!diagnosis} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {diagnosis.title}
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[diagnosis.status] ?? "bg-muted text-muted-foreground"}`}>
              {STATUS_ES[diagnosis.status] ?? diagnosis.status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {prospect && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{prospect.name}</span>
              {prospect.email && <span className="text-muted-foreground/60">· {prospect.email}</span>}
            </div>
          )}

          {diagnosis.sourceUrl && (
            <div className="text-sm">
              <span className="text-muted-foreground">URL analizada: </span>
              <a href={diagnosis.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                {diagnosis.sourceUrl}
              </a>
            </div>
          )}

          {provider && (
            <div className="text-sm">
              <span className="text-muted-foreground">Generado por: </span>
              <Badge variant="outline">{PROVIDER_LABEL[provider] ?? provider}</Badge>
            </div>
          )}

          {analysis && tier && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Puntaje general</p>
                <p className={`text-4xl font-black ${tier.color}`}>{analysis.overallScore}</p>
                <p className={`text-sm font-semibold ${tier.color}`}>{tier.label}</p>
                {analysis.summary && <p className="text-sm text-muted-foreground mt-3">{analysis.summary}</p>}
              </CardContent>
            </Card>
          )}

          {sortedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Tareas priorizadas</p>
              {sortedTasks.map((task, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      <p className="text-sm font-medium">{task.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!analysis && diagnosis.content && (
            <div>
              <Label className="text-xs text-muted-foreground">Contenido</Label>
              <p className="text-sm whitespace-pre-wrap mt-1">{diagnosis.content}</p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between items-center">
          <span className="text-xs text-muted-foreground">{formatDate(diagnosis.createdAt)}</span>
          {analysis && diagnosis.publicToken && (
            <a href={`${PUBLIC_RESULTS_BASE_URL}/${diagnosis.publicToken}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" /> Ver página pública
              </Button>
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
