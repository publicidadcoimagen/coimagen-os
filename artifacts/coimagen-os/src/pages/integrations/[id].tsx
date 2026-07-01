import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetIntegration, getGetIntegrationQueryKey,
  useUpdateIntegration, useDeleteIntegration,
  useListIntegrationLogs, getListIntegrationLogsQueryKey,
  useTestIntegration,
  getListIntegrationsQueryKey,
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
  Plug, ArrowLeft, Trash2, Wifi, WifiOff, Clock,
  CheckCircle2, XCircle, AlertTriangle, Info, Edit2, Save, X,
} from "lucide-react";
import { INTEGRATION_TYPES, INTEGRATION_STATUSES, LOG_ACTION_LABELS } from "./catalog";

type Integration = {
  id: number; name: string; platform: string; description?: string | null;
  status: string; type: string; credentialsRequired?: string | null;
  envVars?: string | null; lastSync?: string | null; responsibleId?: string | null;
  clientId?: number | null; projectId?: number | null; agentId?: number | null;
  notes?: string | null; errors?: string | null; createdAt: string; updatedAt?: string | null;
};
type Log = { id: number; integrationId: number; action: string; message?: string | null; createdAt: string };

function StatusIcon({ status }: { status: string }) {
  if (status === "active")         return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (status === "error")          return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "attention")      return <AlertTriangle className="h-4 w-4 text-orange-400" />;
  if (status === "paused")         return <Clock className="h-4 w-4 text-yellow-400" />;
  if (status === "configured")     return <Wifi className="h-4 w-4 text-blue-400" />;
  return <WifiOff className="h-4 w-4 text-muted-foreground" />;
}

export function IntegrationDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [status, setStatus]         = useState("");
  const [notes, setNotes]           = useState("");
  const [errors, setErrors]         = useState("");
  const [envVars, setEnvVars]       = useState("");

  const { data: raw, isLoading } = useGetIntegration(id, {
    query: {
      queryKey: getGetIntegrationQueryKey(id),
      enabled: id > 0,
    },
  });
  const integration = raw as Integration | undefined;

  const { data: rawLogs = [] } = useListIntegrationLogs(id, {
    query: { queryKey: getListIntegrationLogsQueryKey(id), enabled: id > 0 },
  });
  const logs = rawLogs as Log[];

  const { mutate: update, isPending: saving } = useUpdateIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey({}) });
        setEditing(false);
      },
    },
  });

  const { mutate: del, isPending: deleting } = useDeleteIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey({}) });
        window.history.back();
      },
    },
  });

  const { mutate: test, isPending: testing } = useTestIntegration({
    mutation: {
      onSuccess: (data) => {
        const d = data as { success: boolean; message: string };
        setTestResult(d);
        queryClient.invalidateQueries({ queryKey: getListIntegrationLogsQueryKey(id) });
      },
    },
  });

  function startEdit() {
    if (!integration) return;
    setName(integration.name);
    setDesc(integration.description ?? "");
    setStatus(integration.status);
    setNotes(integration.notes ?? "");
    setErrors(integration.errors ?? "");
    setEnvVars(integration.envVars ?? "");
    setEditing(true);
  }

  function saveEdit() {
    update({ id, data: { name, description: description || undefined, status, notes: notes || undefined, errors: errors || undefined, envVars: envVars || undefined } });
  }

  if (isLoading) return (
    <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
  );

  if (!integration) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <p className="text-muted-foreground">Integración no encontrada.</p>
      <Button variant="outline" size="sm" asChild><Link href="/integrations"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Volver</Link></Button>
    </div>
  );

  const sm = INTEGRATION_STATUSES[integration.status] ?? INTEGRATION_STATUSES["not_configured"];
  const tm = INTEGRATION_TYPES[integration.type];

  let requiredCreds: string[] = [];
  try { requiredCreds = JSON.parse(integration.credentialsRequired ?? "[]"); } catch { requiredCreds = []; }
  let envVarList: string[] = [];
  try { envVarList = JSON.parse(integration.envVars ?? "[]"); } catch { envVarList = []; }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
            <Link href="/integrations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <StatusIcon status={integration.status} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{integration.name}</h1>
              <span className="text-sm text-muted-foreground">{integration.platform}</span>
              <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
              {tm && <Badge variant="outline" className={`text-[9px] py-0 ${tm.color}`}>{tm.label}</Badge>}
            </div>
            {integration.description && <p className="text-sm text-muted-foreground">{integration.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => test({ id })} disabled={testing}>
            <Wifi className="h-3.5 w-3.5 mr-1.5" />{testing ? "Probando..." : "Probar conexión"}
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
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${testResult.success ? "bg-green-400/10 border-green-400/30 text-green-400" : "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"}`}>
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{testResult.success ? "Conexión exitosa" : "Credenciales pendientes"}</p>
            <p className="text-xs opacity-80">{testResult.message}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-60" onClick={() => setTestResult(null)}><X className="h-3 w-3" /></Button>
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList className="h-8">
          <TabsTrigger value="details" className="text-xs">Detalles</TabsTrigger>
          <TabsTrigger value="credentials" className="text-xs">Credenciales</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Información general</CardTitle></CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {editing ? (
                  <>
                    <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
                    <div className="space-y-1.5">
                      <Label>Estado</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(INTEGRATION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
                    {integration.status === "error" && (
                      <div className="space-y-1.5"><Label>Descripción del error</Label><Textarea value={errors} onChange={(e) => setErrors(e.target.value)} rows={2} /></div>
                    )}
                  </>
                ) : (
                  <>
                    <Row label="Plataforma" value={integration.platform} />
                    <Row label="Tipo" value={tm?.label ?? integration.type} />
                    <Row label="Estado" value={sm.label} />
                    <Row label="Creada" value={new Date(integration.createdAt).toLocaleDateString("es-MX")} />
                    {integration.lastSync && <Row label="Última sincronización" value={new Date(integration.lastSync).toLocaleString("es-MX")} />}
                    {integration.responsibleId && <Row label="Responsable" value={integration.responsibleId} />}
                    {integration.clientId && <Row label="Cliente" value={`#${integration.clientId}`} />}
                    {integration.projectId && <Row label="Proyecto" value={`#${integration.projectId}`} />}
                    {integration.notes && <div><p className="text-[9px] text-muted-foreground mb-0.5">Notas</p><p className="text-xs">{integration.notes}</p></div>}
                    {integration.errors && <div className="p-2 rounded bg-red-400/10 border border-red-400/20"><p className="text-[9px] text-red-400/80 mb-0.5">Error</p><p className="text-xs text-red-400">{integration.errors}</p></div>}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Acciones disponibles */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Acciones disponibles</CardTitle></CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {[
                  { label: "Probar conexión", detail: "Verifica si las credenciales son válidas", action: () => test({ id }) },
                  { label: "Activar integración", detail: "Cambia el estado a Activa", action: () => update({ id, data: { status: "active" } }) },
                  { label: "Pausar integración", detail: "Detiene sin eliminar la configuración", action: () => update({ id, data: { status: "paused" } }) },
                  { label: "Marcar con error", detail: "Registra un estado de error para revisión", action: () => update({ id, data: { status: "error" } }) },
                ].map(({ label, detail, action }) => (
                  <button key={label} onClick={action} className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{detail}</p>
                    </div>
                  </button>
                ))}
                <div className="pt-2">
                  <p className="text-[9px] text-muted-foreground mb-1">Relacionar con módulos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["CORE AI", "Workflow", "AI Agents", "Automatizaciones", "Quality Center"].map((m) => (
                      <Badge key={m} variant="outline" className="text-[9px] py-0.5 cursor-pointer hover:bg-muted/40">{m}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs text-muted-foreground">Variables de entorno requeridas</CardTitle></CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                <p className="text-xs text-yellow-400 font-medium mb-1">Seguridad</p>
                <p className="text-[11px] text-yellow-300/80">Las credenciales se configuran como variables de entorno en el servidor. Nunca se almacenan en texto plano en la base de datos.</p>
              </div>
              {requiredCreds.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Credenciales necesarias:</p>
                  <div className="space-y-1.5">
                    {requiredCreds.map((cred) => (
                      <div key={cred} className="flex items-center gap-2 p-2 rounded border border-border/40 bg-muted/10">
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                        <p className="text-xs">{cred}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {envVarList.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Variables de entorno:</p>
                  <div className="space-y-1.5">
                    {envVarList.map((v) => (
                      <div key={v} className="flex items-center gap-2 p-2 rounded border border-border/40 bg-muted/10">
                        <code className="text-xs font-mono text-primary/80">{v}</code>
                        <span className="text-[10px] text-muted-foreground ml-auto">Env var</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {editing && (
                <div className="space-y-1.5">
                  <Label>Variables de entorno (JSON)</Label>
                  <Textarea value={envVars} onChange={(e) => setEnvVars(e.target.value)} rows={3} className="font-mono text-xs" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sin logs registrados</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <Card key={log.id} className="border-border/40">
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${
                      log.action === "error"      ? "bg-red-400" :
                      log.action === "activated"  ? "bg-green-400" :
                      log.action === "paused"     ? "bg-yellow-400" :
                      log.action === "tested"     ? "bg-blue-400" :
                      "bg-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{LOG_ACTION_LABELS[log.action] ?? log.action}</p>
                      {log.message && <p className="text-[11px] text-muted-foreground">{log.message}</p>}
                    </div>
                    <span className="text-[9px] text-muted-foreground flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString("es-MX")}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!o) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar integración?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminarán también todos los logs de esta integración. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del({ id })} disabled={deleting}>
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
