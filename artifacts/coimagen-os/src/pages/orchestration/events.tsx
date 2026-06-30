import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrchestrationEvents, getListOrchestrationEventsQueryKey,
  useCreateOrchestrationEvent, useUpdateOrchestrationEvent,
  useDeleteOrchestrationEvent,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity, Plus, Trash2, CheckCircle2, XCircle, Clock,
  PlayCircle, ChevronDown,
} from "lucide-react";
import {
  EVENT_CATALOG, SOURCE_LABELS, PRIORITY_META, STATUS_META, getEventLabel,
} from "./catalog";

type OEvent = {
  id: number; eventType: string; source: string; destination?: string | null;
  priority: string; status: string; clientId?: number | null; projectId?: number | null;
  userId?: string | null; notes?: string | null; createdAt: string;
};

const STATUSES = ["pending", "active", "completed", "failed"];

function CreateEventDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState("contrato_firmado");
  const [source, setSource] = useState("manual");
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState("pending");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");

  const { mutate: create, isPending } = useCreateOrchestrationEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrchestrationEventsQueryKey({}) });
        onClose(); reset();
      },
    },
  });

  function reset() {
    setEventType("contrato_firmado"); setSource("manual"); setPriority("normal");
    setStatus("pending"); setDestination(""); setNotes(""); setClientId(""); setProjectId("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Registrar Evento</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de evento *</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_CATALOG.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origen *</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s]?.label ?? s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Destino</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Módulo destino" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ID Cliente</Label><Input type="number" value={clientId} onChange={(e) => setClientId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>ID Proyecto</Label><Input type="number" value={projectId} onChange={(e) => setProjectId(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={() => create({ data: {
              eventType, source, destination: destination || undefined, priority, status,
              clientId: clientId ? parseInt(clientId) : undefined,
              projectId: projectId ? parseInt(projectId) : undefined,
              notes: notes || undefined,
            } })} disabled={isPending}>
              {isPending ? "Registrando..." : "Registrar Evento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ event, onDelete, onUpdateStatus }: {
  event: OEvent;
  onDelete: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => void;
}) {
  const sm = STATUS_META[event.status] ?? STATUS_META["pending"];
  const pm = PRIORITY_META[event.priority] ?? PRIORITY_META["normal"];

  return (
    <Card className="border-border/50 group">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1.5 ${
            event.status === "completed" ? "bg-green-400" :
            event.status === "failed"    ? "bg-red-400" :
            event.status === "active"    ? "bg-blue-400 animate-pulse" : "bg-yellow-400"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold">{getEventLabel(event.eventType)}</p>
              <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
              <Badge variant="outline" className={`text-[9px] py-0 ${pm.color}`}>{pm.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span>Origen: <strong>{SOURCE_LABELS[event.source] ?? event.source}</strong></span>
              {event.destination && <span>→ {event.destination}</span>}
              {event.clientId && <span>Cliente #{event.clientId}</span>}
              {event.projectId && <span>Proyecto #{event.projectId}</span>}
              <span>{new Date(event.createdAt).toLocaleString("es-MX")}</span>
            </div>
            {event.notes && <p className="text-[11px] text-muted-foreground mt-1 italic">{event.notes}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {event.status === "pending" && (
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-400 hover:text-green-300" title="Completar" onClick={() => onUpdateStatus(event.id, "completed")}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {(event.status === "pending" || event.status === "active") && (
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" title="Falló" onClick={() => onUpdateStatus(event.id, "failed")}>
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(event.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventMonitor() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawEvents = [], isLoading } = useListOrchestrationEvents(
    {}, { query: { queryKey: getListOrchestrationEventsQueryKey({}) } },
  );
  const events = rawEvents as OEvent[];

  const { mutate: updateEvent } = useUpdateOrchestrationEvent({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrchestrationEventsQueryKey({}) }) },
  });
  const { mutate: deleteEvent } = useDeleteOrchestrationEvent({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrchestrationEventsQueryKey({}) }); setDeleteId(null); } },
  });

  const tabs = [
    { key: "all",       label: "Todos",       items: events },
    { key: "pending",   label: "Pendientes",  items: events.filter((e) => e.status === "pending") },
    { key: "active",    label: "Activos",     items: events.filter((e) => e.status === "active") },
    { key: "completed", label: "Completados", items: events.filter((e) => e.status === "completed") },
    { key: "failed",    label: "Fallidos",    items: events.filter((e) => e.status === "failed") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Event Monitor</h1>
            <p className="text-sm text-muted-foreground">{events.length} eventos en el bus</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Registrar evento
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { s: "pending",   icon: Clock,        count: events.filter((e) => e.status === "pending").length },
          { s: "active",    icon: Activity,     count: events.filter((e) => e.status === "active").length },
          { s: "completed", icon: CheckCircle2, count: events.filter((e) => e.status === "completed").length },
          { s: "failed",    icon: XCircle,      count: events.filter((e) => e.status === "failed").length },
        ].map(({ s, icon: Icon, count }) => {
          const sm = STATUS_META[s]!;
          return (
            <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${sm.color}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{count} {sm.label}{count !== 1 ? "s" : ""}</span>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="h-8 flex-wrap">
          {tabs.map(({ key, label, items }) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {label} ({items.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ key, items }) => (
          <TabsContent key={key} value={key} className="mt-3">
            {isLoading ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-14" /></Card>)}</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/50 rounded-xl gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-20" />
                <p className="text-sm">Sin eventos en esta categoría</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onDelete={(id) => setDeleteId(id)}
                    onUpdateStatus={(id, status) => updateEvent({ id, data: { status } })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateEventDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteEvent({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
