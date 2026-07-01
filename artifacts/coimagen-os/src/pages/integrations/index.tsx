import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListIntegrations, getListIntegrationsQueryKey,
  useCreateIntegration,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plug, Plus, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronRight, Search, Layers,
} from "lucide-react";
import {
  INTEGRATION_TEMPLATES, INTEGRATION_TYPES, INTEGRATION_STATUSES,
  type IntegrationTemplate,
} from "./catalog";

type Integration = {
  id: number; name: string; platform: string; description?: string | null;
  status: string; type: string; credentialsRequired?: string | null;
  envVars?: string | null; lastSync?: string | null;
  errors?: string | null; createdAt: string;
};

function StatusDot({ status }: { status: string }) {
  const c = status === "active" ? "bg-green-400" : status === "error" ? "bg-red-400 animate-pulse" : status === "attention" ? "bg-orange-400 animate-pulse" : status === "paused" ? "bg-yellow-400" : status === "configured" ? "bg-blue-400" : "bg-muted";
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${c}`} />;
}

function AddFromCatalogDialog({ open, onClose, existing }: {
  open: boolean; onClose: () => void; existing: Integration[];
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const { mutate: create } = useCreateIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey({}) });
        setCreating(null);
      },
    },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  const filtered = INTEGRATION_TEMPLATES.filter(
    (t) => !existingNames.has(t.name.toLowerCase()) &&
      (search === "" || t.name.toLowerCase().includes(search.toLowerCase()) || t.platform.toLowerCase().includes(search.toLowerCase())),
  );

  function handleAdd(t: IntegrationTemplate) {
    setCreating(t.name);
    create({
      data: {
        name: t.name,
        platform: t.platform,
        description: t.description,
        type: t.type,
        status: "not_configured",
        credentialsRequired: JSON.stringify(t.credentialsRequired),
        envVars: JSON.stringify(t.envVars),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSearch(""); onClose(); } }}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-primary" />Agregar integración del catálogo</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar integración..." className="pl-9" />
        </div>
        <div className="overflow-y-auto space-y-2 flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">Todas las integraciones del catálogo ya están agregadas.</p>
          ) : filtered.map((t) => {
            const tm = INTEGRATION_TYPES[t.type];
            return (
              <div key={t.name} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{t.name}</p>
                    <span className="text-[10px] text-muted-foreground">{t.platform}</span>
                    {tm && <Badge variant="outline" className={`text-[9px] py-0 ${tm.color}`}>{tm.label}</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={() => handleAdd(t)} disabled={creating === t.name}>
                  {creating === t.name ? "..." : <><Plus className="h-3 w-3 mr-1" />Agregar</>}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationHub() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: rawIntegrations = [], isLoading } = useListIntegrations(
    {}, { query: { queryKey: getListIntegrationsQueryKey({}) } },
  );
  const integrations = rawIntegrations as Integration[];

  const filtered = integrations.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (typeFilter   !== "all" && i.type   !== typeFilter)   return false;
    return true;
  });

  // Grouped by type
  const byType = Object.entries(INTEGRATION_TYPES).map(([type, meta]) => ({
    type, meta,
    items: filtered.filter((i) => i.type === type),
  })).filter((g) => g.items.length > 0);

  const counts = {
    active:         integrations.filter((i) => i.status === "active").length,
    error:          integrations.filter((i) => i.status === "error").length,
    attention:      integrations.filter((i) => i.status === "attention").length,
    not_configured: integrations.filter((i) => i.status === "not_configured").length,
    configured:     integrations.filter((i) => i.status === "configured").length,
    paused:         integrations.filter((i) => i.status === "paused").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Integration Hub</h1>
            <p className="text-sm text-muted-foreground">{integrations.length} integraciones · Centro de conexiones externas</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCatalogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Agregar integración
        </Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { key: "active",         label: "Activas",          icon: CheckCircle2, color: "text-green-400" },
          { key: "configured",     label: "Configuradas",     icon: Plug,         color: "text-blue-400" },
          { key: "paused",         label: "Pausadas",         icon: Clock,        color: "text-yellow-400" },
          { key: "not_configured", label: "No configuradas",  icon: Layers,       color: "text-muted-foreground" },
          { key: "attention",      label: "Atención",         icon: AlertTriangle,color: "text-orange-400" },
          { key: "error",          label: "Con error",        icon: XCircle,      color: "text-red-400" },
        ].map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className={`border-border/40 cursor-pointer transition-all ${statusFilter === key ? "border-primary/40 bg-primary/5" : ""}`}
            onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <p className={`text-xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(INTEGRATION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(INTEGRATION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || typeFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Empty state */}
      {isLoading ? (
        <div className="space-y-2">{Array(4).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
      ) : integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <Plug className="h-12 w-12 opacity-20" />
          <p className="text-sm">No hay integraciones configuradas</p>
          <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Agregar del catálogo</Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-10">Sin integraciones con los filtros seleccionados.</p>
      ) : (
        /* Grouped by type */
        <div className="space-y-5">
          {byType.map(({ type, meta, items }) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-[10px] py-0.5 ${meta.color}`}>{meta.label}</Badge>
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((integration) => {
                  const sm = INTEGRATION_STATUSES[integration.status] ?? INTEGRATION_STATUSES["not_configured"];
                  return (
                    <Link key={integration.id} href={`/integrations/${integration.id}`}>
                      <Card className="border-border/40 hover:border-primary/20 transition-all cursor-pointer group">
                        <CardContent className="p-3 flex items-center gap-3">
                          <StatusDot status={integration.status} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{integration.name}</p>
                              <span className="text-[10px] text-muted-foreground">{integration.platform}</span>
                              <Badge variant="outline" className={`text-[9px] py-0 ${sm.color}`}>{sm.label}</Badge>
                            </div>
                            {integration.description && <p className="text-[11px] text-muted-foreground truncate">{integration.description}</p>}
                            {integration.status === "error" && integration.errors && (
                              <p className="text-[10px] text-red-400 truncate mt-0.5">⚠ {integration.errors}</p>
                            )}
                          </div>
                          {integration.lastSync && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden md:block">
                              Sync: {new Date(integration.lastSync).toLocaleDateString("es-MX")}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-primary transition-colors" />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddFromCatalogDialog open={catalogOpen} onClose={() => setCatalogOpen(false)} existing={integrations} />
    </div>
  );
}
