import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListIncidents, getListIncidentsQueryKey,
  useCreateIncident, useDeleteIncident,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bug, Plus, Search, Filter, Trash2, ChevronLeft, AlertTriangle,
  CheckCircle2, Clock, ChevronRight,
} from "lucide-react";

const INCIDENT_TYPES = [
  "bug", "incidente", "mejora", "optimización",
  "automatización_fallida", "error_ia", "error_api",
  "error_cliente", "error_producción",
];

const MODULES = [
  "Dashboard", "Clientes", "Proyectos", "Tareas", "Agentes IA",
  "Onboarding", "Workflow Engine", "Quality Center",
  "Comercial", "Finanzas", "Facturación", "Suscripciones",
  "HQ Operations", "Organización", "Mundos", "API", "Base de datos",
];

const SEVERITY_COLOR: Record<string, string> = {
  low:      "bg-slate-400/15 text-slate-400 border-slate-400/30",
  medium:   "bg-blue-400/15 text-blue-400 border-blue-400/30",
  high:     "bg-orange-400/15 text-orange-400 border-orange-400/30",
  critical: "bg-red-400/15 text-red-400 border-red-400/30",
};

const STATUS_COLOR: Record<string, string> = {
  open:        "bg-orange-400/15 text-orange-400 border-orange-400/30",
  in_progress: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  resolved:    "bg-green-400/15 text-green-400 border-green-400/30",
  closed:      "bg-slate-400/15 text-slate-400 border-slate-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto", in_progress: "En progreso", resolved: "Resuelto", closed: "Cerrado",
};

type Inc = {
  id: number; type: string; title: string; description?: string | null;
  severity: string; priority: string; status: string; module?: string | null;
  clientId?: number | null; ticketId?: number | null; createdAt: string;
};

function CreateIncidentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [priority, setPriority] = useState("medium");
  const [module, setModule] = useState("");
  const [date, setDate] = useState("");
  const [evidences, setEvidences] = useState("");
  const [logs, setLogs] = useState("");

  const { mutate: create, isPending } = useCreateIncident({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey({}) });
        navigate(`/quality-center/incidents/${(data as Inc).id}`);
        onClose();
      },
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    create({ data: {
      type, title: title.trim(), description: description || undefined,
      severity, priority, module: module || undefined,
      date: date || undefined, evidences: evidences || undefined,
      logs: logs || undefined,
    }});
  };

  const reset = () => {
    setTitle(""); setDescription(""); setType("bug"); setSeverity("medium");
    setPriority("medium"); setModule(""); setDate(""); setEvidences(""); setLogs("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bug className="h-4 w-4 text-red-400" />Registrar Incidente</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descripción breve del incidente..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalle completo del incidente..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
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
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Evidencias</Label>
            <Textarea value={evidences} onChange={(e) => setEvidences(e.target.value)} rows={2} placeholder="URLs, capturas, descripción de evidencias..." />
          </div>
          <div className="space-y-1.5">
            <Label>Logs</Label>
            <Textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={2} placeholder="Stack trace, error logs..." className="font-mono text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!title.trim() || isPending}>
              {isPending ? "Registrando..." : "Registrar incidente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IncidentCenter() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const { data: rawInc = [], isLoading } = useListIncidents({}, { query: { queryKey: getListIncidentsQueryKey({}) } });

  const { mutate: deleteInc } = useDeleteIncident({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey({}) });
        setDeleteId(null);
      },
    },
  });

  const all = rawInc as Inc[];
  const filtered = all.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
    return true;
  });

  const byStatus = (s: string) => filtered.filter((i) => i.status === s);

  const IncRow = ({ inc }: { inc: Inc }) => (
    <Card className="border-border/50 hover:border-primary/30 transition-all group">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link href={`/quality-center/incidents/${inc.id}`}>
                <span className="text-sm font-medium hover:text-primary transition-colors">{inc.title}</span>
              </Link>
              <Badge variant="outline" className={`text-[10px] py-0 ${SEVERITY_COLOR[inc.severity] ?? ""}`}>{inc.severity}</Badge>
              <span className="text-[10px] text-muted-foreground">{inc.type}</span>
              {inc.module && <span className="text-[10px] text-muted-foreground/60">{inc.module}</span>}
              {inc.ticketId && <Badge variant="outline" className="text-[9px] py-0 bg-primary/10 text-primary border-primary/30">Ticket #{inc.ticketId}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_COLOR[inc.status] ?? ""}`}>{STATUS_LABEL[inc.status] ?? inc.status}</Badge>
              <span className="text-[10px] text-muted-foreground">{new Date(inc.createdAt).toLocaleDateString("es-MX")}</span>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all" onClick={() => setDeleteId(inc.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
            <Link href="/quality-center"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-400/10 flex items-center justify-center">
              <Bug className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Incident Center</h1>
              <p className="text-sm text-muted-foreground">Bugs, incidentes, mejoras y errores del sistema</p>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Registrar Incidente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Abiertos", value: all.filter((i) => i.status === "open").length, icon: AlertTriangle, color: "text-orange-400" },
          { label: "En progreso", value: all.filter((i) => i.status === "in_progress").length, icon: Clock, color: "text-blue-400" },
          { label: "Resueltos", value: all.filter((i) => i.status === "resolved").length, icon: CheckCircle2, color: "text-green-400" },
          { label: "Críticos", value: all.filter((i) => i.severity === "critical").length, icon: Bug, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold">{value}</p>
                <Icon className={`h-5 w-5 ${color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar incidentes..." className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterType !== "all" || filterSeverity !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setFilterType("all"); setFilterSeverity("all"); }}>
            <Filter className="h-3 w-3 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabs by status */}
      <Tabs defaultValue="all">
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="open" className="text-xs">Abiertos ({byStatus("open").length})</TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs">En progreso ({byStatus("in_progress").length})</TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs">Resueltos ({byStatus("resolved").length + byStatus("closed").length})</TabsTrigger>
        </TabsList>

        {(["all", "open", "in_progress", "resolved"] as const).map((tab) => {
          const list = tab === "all" ? filtered : tab === "resolved"
            ? filtered.filter((i) => i.status === "resolved" || i.status === "closed")
            : byStatus(tab);
          return (
            <TabsContent key={tab} value={tab} className="mt-3">
              {isLoading ? (
                <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-14 bg-muted/20" /></Card>)}</div>
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 opacity-20" />
                  <p className="text-sm">No hay incidentes en esta categoría</p>
                  {tab === "all" && <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Registrar primero</Button>}
                </div>
              ) : (
                <div className="space-y-2">{list.map((inc) => <IncRow key={inc.id} inc={inc} />)}</div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <CreateIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar incidente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El incidente y su ticket asociado serán eliminados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteInc({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
