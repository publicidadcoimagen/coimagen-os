import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetIncident, getGetIncidentQueryKey, getListIncidentsQueryKey,
  useUpdateIncident, useConvertIncidentToTicket,
  useListQcTickets, getListQcTicketsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Bug, ChevronLeft, ChevronRight, Edit2, Ticket, User, Info,
  Clock, AlertTriangle, CheckCircle2, ShieldCheck, BookOpen,
} from "lucide-react";

const INCIDENT_TYPES = [
  "bug","incidente","mejora","optimización",
  "automatización_fallida","error_ia","error_api","error_cliente","error_producción",
];
const MODULES = [
  "Dashboard","Clientes","Proyectos","Tareas","Agentes IA","Onboarding","Workflow Engine",
  "Quality Center","Comercial","Finanzas","Facturación","Suscripciones",
  "HQ Operations","Organización","Mundos","API","Base de datos",
];
const SEVERITY_COLOR: Record<string, string> = {
  low:"bg-slate-400/15 text-slate-400 border-slate-400/30",
  medium:"bg-blue-400/15 text-blue-400 border-blue-400/30",
  high:"bg-orange-400/15 text-orange-400 border-orange-400/30",
  critical:"bg-red-400/15 text-red-400 border-red-400/30",
};
const STATUS_COLOR: Record<string, string> = {
  open:"bg-orange-400/15 text-orange-400 border-orange-400/30",
  in_progress:"bg-blue-400/15 text-blue-400 border-blue-400/30",
  resolved:"bg-green-400/15 text-green-400 border-green-400/30",
  closed:"bg-slate-400/15 text-slate-400 border-slate-400/30",
};
const STATUS_LABEL: Record<string, string> = {
  open:"Abierto",in_progress:"En progreso",resolved:"Resuelto",closed:"Cerrado",
};

type Inc = {
  id: number; type: string; title: string; description?: string | null;
  severity: string; priority: string; status: string; module?: string | null;
  clientId?: number | null; projectId?: number | null; workflowId?: number | null;
  mundoId?: number | null; agentId?: number | null; evidences?: string | null;
  logs?: string | null; date?: string | null; timeSpent?: number | null;
  responsibleId?: string | null; solution?: string | null; lessonLearned?: string | null;
  ticketId?: number | null; createdAt: string; updatedAt?: string | null;
};
type Ticket = {
  id: number; title: string; status: string; priority: string;
  assignedToName?: string | null; dueDate?: string | null; createdAt: string;
};

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
function EditDialog({ inc, open, onClose }: { inc: Inc; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(inc.type);
  const [title, setTitle] = useState(inc.title);
  const [description, setDescription] = useState(inc.description ?? "");
  const [severity, setSeverity] = useState(inc.severity);
  const [priority, setPriority] = useState(inc.priority);
  const [status, setStatus] = useState(inc.status);
  const [module, setModule] = useState(inc.module ?? "");
  const [timeSpent, setTimeSpent] = useState(inc.timeSpent ? String(inc.timeSpent) : "");
  const [responsibleId, setResponsibleId] = useState(inc.responsibleId ?? "");
  const [solution, setSolution] = useState(inc.solution ?? "");
  const [lessonLearned, setLessonLearned] = useState(inc.lessonLearned ?? "");
  const [evidences, setEvidences] = useState(inc.evidences ?? "");
  const [logs, setLogs] = useState(inc.logs ?? "");

  const { mutate: update, isPending } = useUpdateIncident({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIncidentQueryKey(inc.id) });
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey({}) });
        onClose();
      },
    },
  });

  const handleSave = () => {
    update({ id: inc.id, data: {
      type, title, description: description || undefined, severity, priority, status,
      module: module || undefined, timeSpent: timeSpent ? Number(timeSpent) : undefined,
      responsibleId: responsibleId || undefined, solution: solution || undefined,
      lessonLearned: lessonLearned || undefined, evidences: evidences || undefined,
      logs: logs || undefined,
    }});
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Incidente #{inc.id}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem><SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem><SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem><SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem><SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select value={module} onValueChange={setModule}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="">—</SelectItem>{MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tiempo invertido (min)</Label><Input type="number" value={timeSpent} onChange={(e) => setTimeSpent(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label>Responsable</Label><Input value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} placeholder="Nombre o ID" /></div>
          </div>
          <div className="space-y-1.5"><Label>Evidencias</Label><Textarea value={evidences} onChange={(e) => setEvidences(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Logs</Label><Textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={2} className="font-mono text-xs" /></div>
          <div className="space-y-1.5"><Label>Solución</Label><Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder="¿Cómo se resolvió?" /></div>
          <div className="space-y-1.5"><Label>Lección aprendida</Label><Textarea value={lessonLearned} onChange={(e) => setLessonLearned(e.target.value)} rows={2} placeholder="¿Qué aprendimos?" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || isPending}>{isPending ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convert to Ticket Dialog ─────────────────────────────────────────────────
function ConvertTicketDialog({ inc, open, onClose }: { inc: Inc; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [assignedToName, setAssignedToName] = useState("");
  const [assignedToType, setAssignedToType] = useState("director");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate: convert, isPending } = useConvertIncidentToTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIncidentQueryKey(inc.id) });
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListQcTicketsQueryKey({}) });
        onClose();
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />Convertir a Ticket</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
            <p className="text-xs text-muted-foreground">Incidente</p>
            <p className="text-sm font-medium">{inc.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select value={assignedToType} onValueChange={setAssignedToType}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre / ID</Label>
              <Input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} placeholder="Nombre del responsable" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Fecha límite</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => convert({ id: inc.id, data: { assignedToType, assignedToName: assignedToName || undefined, dueDate: dueDate || undefined, notes: notes || undefined } })} disabled={isPending}>
              {isPending ? "Convirtiendo..." : "Crear Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────
export function IncidentDetail() {
  const [, params] = useRoute("/quality-center/incidents/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: rawInc, isLoading } = useGetIncident(id, {
    query: { queryKey: getGetIncidentQueryKey(id), enabled: id > 0 },
  });

  const { data: rawTickets = [] } = useListQcTickets({}, {
    query: { queryKey: getListQcTicketsQueryKey({}) },
  });

  const inc = rawInc as Inc | undefined;
  const linkedTicket = inc?.ticketId
    ? (rawTickets as Ticket[]).find((t) => t.id === inc.ticketId)
    : undefined;

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-sm text-muted-foreground animate-pulse">Cargando incidente...</p></div>;
  if (!inc) return (
    <div className="flex flex-col items-center gap-3 min-h-[60vh] justify-center">
      <Bug className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Incidente no encontrado</p>
      <Button variant="outline" size="sm" asChild><Link href="/quality-center/incidents"><ChevronLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
    </div>
  );

  const severityColor = SEVERITY_COLOR[inc.severity] ?? "";
  const statusColor = STATUS_COLOR[inc.status] ?? "";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/quality-center" className="hover:text-foreground">Quality Center</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/quality-center/incidents" className="hover:text-foreground">Incidents</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">#{inc.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono">INC-{String(inc.id).padStart(4, "0")}</span>
            <Badge variant="outline" className={`text-[10px] py-0 ${severityColor}`}>{inc.severity}</Badge>
            <Badge variant="outline" className={`text-[10px] py-0 ${statusColor}`}>{STATUS_LABEL[inc.status] ?? inc.status}</Badge>
            <span className="text-[10px] text-muted-foreground">{inc.type}</span>
            {inc.module && <Badge variant="outline" className="text-[10px] py-0 bg-muted/20 text-muted-foreground">{inc.module}</Badge>}
            {inc.ticketId && <Badge variant="outline" className="text-[10px] py-0 bg-primary/10 text-primary border-primary/30"><Ticket className="h-2.5 w-2.5 mr-0.5" />Ticket #{inc.ticketId}</Badge>}
          </div>
          <h1 className="text-xl font-bold">{inc.title}</h1>
          <p className="text-xs text-muted-foreground">
            Creado: {new Date(inc.createdAt).toLocaleString("es-MX")}
            {inc.updatedAt && ` · Actualizado: ${new Date(inc.updatedAt).toLocaleString("es-MX")}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar</Button>
          {!inc.ticketId && (
            <Button size="sm" onClick={() => setConvertOpen(true)}><Ticket className="h-3.5 w-3.5 mr-1.5" />Crear Ticket</Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left: metadata */}
        <div className="col-span-1 space-y-3">
          <Card className="border-border/50">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Metadatos</p>
              {[
                { icon: AlertTriangle, label: "Prioridad", value: inc.priority },
                { icon: Clock, label: "Tiempo", value: inc.timeSpent ? `${inc.timeSpent} min` : "—" },
                { icon: User, label: "Responsable", value: inc.responsibleId ?? "—" },
                { icon: Info, label: "Fecha", value: inc.date ?? "—" },
                { icon: ShieldCheck, label: "Módulo", value: inc.module ?? "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}:</span>
                  <span className="text-xs truncate">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {linkedTicket && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />Ticket vinculado</p>
                <p className="text-xs font-medium">{linkedTicket.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[9px] py-0">{linkedTicket.status}</Badge>
                  {linkedTicket.assignedToName && <span className="text-[10px] text-muted-foreground">{linkedTicket.assignedToName}</span>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: tabs */}
        <div className="col-span-2">
          <Tabs defaultValue="detail">
            <TabsList className="h-8">
              <TabsTrigger value="detail" className="text-xs gap-1"><Info className="h-3 w-3" />Detalle</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Evidencias / Logs</TabsTrigger>
              <TabsTrigger value="resolution" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Resolución</TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="mt-3 space-y-3">
              {inc.description ? (
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm whitespace-pre-wrap">{inc.description}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground py-4 text-center">Sin descripción registrada</p>}
            </TabsContent>

            <TabsContent value="logs" className="mt-3 space-y-3">
              {inc.evidences && (
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Evidencias</p>
                  <p className="text-sm whitespace-pre-wrap">{inc.evidences}</p>
                </div>
              )}
              {inc.logs && (
                <div className="p-3 rounded-lg border border-border/40 bg-black/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Logs</p>
                  <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono overflow-x-auto">{inc.logs}</pre>
                </div>
              )}
              {!inc.evidences && !inc.logs && <p className="text-xs text-muted-foreground py-4 text-center">Sin evidencias ni logs registrados</p>}
            </TabsContent>

            <TabsContent value="resolution" className="mt-3 space-y-3">
              {inc.solution ? (
                <div className="p-3 rounded-lg border border-green-400/20 bg-green-400/5">
                  <p className="text-xs font-semibold text-green-400 mb-1">✓ Solución</p>
                  <p className="text-sm whitespace-pre-wrap">{inc.solution}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground py-2">Sin solución documentada aún.</p>}
              {inc.lessonLearned ? (
                <div className="p-3 rounded-lg border border-blue-400/20 bg-blue-400/5">
                  <p className="text-xs font-semibold text-blue-400 mb-1">💡 Lección aprendida</p>
                  <p className="text-sm whitespace-pre-wrap">{inc.lessonLearned}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground py-2">Sin lección aprendida documentada.</p>}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {inc && <EditDialog inc={inc} open={editOpen} onClose={() => setEditOpen(false)} />}
      {inc && <ConvertTicketDialog inc={inc} open={convertOpen} onClose={() => setConvertOpen(false)} />}
    </div>
  );
}
