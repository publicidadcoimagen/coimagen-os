import { useState } from "react";
import {
  useListDirectors,
  useUpdateDirector,
  useAssignDirectorClient,
  useAssignDirectorProject,
  useUnassignDirectorClient,
  useUnassignDirectorProject,
  getListDirectorsQueryKey,
} from "@workspace/api-client-react";
import { useListClients, useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Network, Users, FolderKanban, Bot, Zap, ChevronDown, ChevronUp,
  Edit2, Plus, X, Target, BarChart3, Shield, Crown, Cpu,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Director = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  objetivo?: string | null;
  responsabilidades?: string[];
  kpis?: string[];
  status: string;
  sortOrder: number;
  agentCount?: number;
  automationCount?: number;
  assignedClients?: { id: number; name: string }[];
  assignedProjects?: { id: number; name: string }[];
  createdAt: string;
  updatedAt?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-400/15 text-green-400 border-green-400/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

const DIRECTOR_ICONS: Record<string, string> = {
  director_comercial: "💼",
  director_marketing: "📣",
  director_produccion: "🎬",
  director_seo: "🔍",
  director_automatizacion: "⚡",
  director_clientes: "🤝",
  director_administracion: "📋",
  director_finanzas: "💰",
  director_cloud_systems: "☁️",
  director_ia: "🧠",
};

function OrgChart({ directors }: { directors: Director[] }) {
  return (
    <div className="flex flex-col items-center gap-0 select-none">
      {/* CEO */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-primary/40 bg-primary/10 shadow-lg shadow-primary/10">
          <Crown className="h-4 w-4 text-primary" />
          <div className="text-center">
            <p className="text-xs font-bold text-primary tracking-wide uppercase">CEO</p>
            <p className="text-[10px] text-primary/70">Camila Segovia</p>
          </div>
        </div>
        <div className="w-px h-6 bg-border" />
      </div>

      {/* CORE AI */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-secondary/40 bg-secondary/10 shadow-md shadow-secondary/5">
          <Cpu className="h-4 w-4 text-secondary" />
          <div className="text-center">
            <p className="text-xs font-bold text-secondary tracking-wide uppercase">CORE AI</p>
            <p className="text-[10px] text-secondary/70">Núcleo de Inteligencia</p>
          </div>
        </div>
        <div className="w-px h-6 bg-border" />
        {/* Horizontal connector */}
        <div className="relative flex items-start justify-center" style={{ width: "100%" }}>
          <div className="w-full max-w-5xl h-px bg-border relative">
            {directors.map((_, i) => {
              const total = directors.length;
              const pct = total <= 1 ? 50 : (i / (total - 1)) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 w-px h-5 bg-border"
                  style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Director labels row */}
      <div className="flex flex-wrap justify-center gap-2 mt-1 max-w-5xl">
        {directors.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 text-[11px] font-medium text-muted-foreground whitespace-nowrap"
          >
            <span>{DIRECTOR_ICONS[d.key] ?? "🏢"}</span>
            <span className="max-w-[90px] truncate">{d.name.replace("Director ", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectorEditDialog({
  director,
  open,
  onClose,
  clients,
  projects,
}: {
  director: Director;
  open: boolean;
  onClose: () => void;
  clients: { id: number; name: string }[];
  projects: { id: number; name: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListDirectorsQueryKey() });

  const updateDirector = useUpdateDirector({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Director actualizado" }); },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    }
  });
  const assignClient = useAssignDirectorClient({ mutation: { onSuccess: invalidate } });
  const unassignClient = useUnassignDirectorClient({ mutation: { onSuccess: invalidate } });
  const assignProject = useAssignDirectorProject({ mutation: { onSuccess: invalidate } });
  const unassignProject = useUnassignDirectorProject({ mutation: { onSuccess: invalidate } });

  const [desc, setDesc] = useState(director.description ?? "");
  const [obj, setObj] = useState(director.objetivo ?? "");
  const [resp, setResp] = useState((director.responsabilidades ?? []).join("\n"));
  const [kpisText, setKpisText] = useState((director.kpis ?? []).join("\n"));
  const [status, setStatus] = useState(director.status);

  const handleSave = () => {
    updateDirector.mutate({
      id: director.id,
      data: {
        description: desc,
        objetivo: obj,
        responsabilidades: resp.split("\n").map((s) => s.trim()).filter(Boolean),
        kpis: kpisText.split("\n").map((s) => s.trim()).filter(Boolean),
        status,
      },
    });
    onClose();
  };

  const assignedClientIds = new Set((director.assignedClients ?? []).map((c) => c.id));
  const assignedProjectIds = new Set((director.assignedProjects ?? []).map((p) => p.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{DIRECTOR_ICONS[director.key] ?? "🏢"}</span>
            {director.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 h-16 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Objetivo</Label>
            <Textarea value={obj} onChange={(e) => setObj(e.target.value)} className="mt-1 h-16 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Responsabilidades (una por línea)</Label>
            <Textarea value={resp} onChange={(e) => setResp(e.target.value)} className="mt-1 h-24 text-sm font-mono" />
          </div>
          <div>
            <Label className="text-xs">KPIs (uno por línea)</Label>
            <Textarea value={kpisText} onChange={(e) => setKpisText(e.target.value)} className="mt-1 h-24 text-sm font-mono" />
          </div>

          {/* Assign Clients */}
          <div>
            <Label className="text-xs mb-2 block">Clientes Asignados</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(director.assignedClients ?? []).map((c) => (
                <Badge key={c.id} variant="outline" className="gap-1 pr-1 text-xs">
                  {c.name}
                  <button
                    onClick={() => unassignClient.mutate({ id: director.id, clientId: c.id })}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => {
              const id = parseInt(v);
              if (!assignedClientIds.has(id)) {
                assignClient.mutate({ id: director.id, data: { clientId: id } });
              }
            }}>
              <SelectTrigger className="w-48 h-7 text-xs">
                <SelectValue placeholder="+ Agregar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.filter((c) => !assignedClientIds.has(c.id)).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign Projects */}
          <div>
            <Label className="text-xs mb-2 block">Proyectos Asignados</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(director.assignedProjects ?? []).map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1 pr-1 text-xs">
                  {p.name}
                  <button
                    onClick={() => unassignProject.mutate({ id: director.id, projectId: p.id })}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => {
              const id = parseInt(v);
              if (!assignedProjectIds.has(id)) {
                assignProject.mutate({ id: director.id, data: { projectId: id } });
              }
            }}>
              <SelectTrigger className="w-48 h-7 text-xs">
                <SelectValue placeholder="+ Agregar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter((p) => !assignedProjectIds.has(p.id)).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateDirector.isPending}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DirectorCard({
  director,
  canEdit,
  clients,
  projects,
}: {
  director: Director;
  canEdit: boolean;
  clients: { id: number; name: string }[];
  projects: { id: number; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Card className="border-border/50 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl flex-shrink-0">{DIRECTOR_ICONS[director.key] ?? "🏢"}</span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-tight truncate">{director.name}</CardTitle>
                <Badge
                  variant="outline"
                  className={`mt-1 text-[10px] ${STATUS_COLORS[director.status] ?? ""}`}
                >
                  {director.status === "active" ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setEditOpen(true)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3">
          {director.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{director.description}</p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/30">
              <Bot className="h-3.5 w-3.5 text-primary/60" />
              <div>
                <p className="text-[10px] text-muted-foreground">Agentes</p>
                <p className="text-sm font-bold">{director.agentCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/30">
              <Zap className="h-3.5 w-3.5 text-secondary/60" />
              <div>
                <p className="text-[10px] text-muted-foreground">Automatizaciones</p>
                <p className="text-sm font-bold">{director.automationCount ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Assigned clients/projects */}
          <div className="flex flex-wrap gap-1">
            {(director.assignedClients ?? []).slice(0, 2).map((c) => (
              <Badge key={c.id} variant="outline" className="text-[10px] gap-1 py-0">
                <Users className="h-2.5 w-2.5" />{c.name}
              </Badge>
            ))}
            {(director.assignedClients ?? []).length > 2 && (
              <Badge variant="outline" className="text-[10px] py-0">
                +{(director.assignedClients ?? []).length - 2}
              </Badge>
            )}
            {(director.assignedProjects ?? []).slice(0, 1).map((p) => (
              <Badge key={p.id} variant="outline" className="text-[10px] gap-1 py-0">
                <FolderKanban className="h-2.5 w-2.5" />{p.name}
              </Badge>
            ))}
            {(director.assignedProjects ?? []).length > 1 && (
              <Badge variant="outline" className="text-[10px] py-0">
                +{(director.assignedProjects ?? []).length - 1} proy.
              </Badge>
            )}
          </div>

          {/* Expandable details */}
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground gap-1">
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? "Menos detalle" : "Ver detalle"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {director.objetivo && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Target className="h-3.5 w-3.5 text-primary/60" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-5">{director.objetivo}</p>
                </div>
              )}

              {(director.responsabilidades ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Shield className="h-3.5 w-3.5 text-secondary/60" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsabilidades</p>
                  </div>
                  <ul className="space-y-1 pl-5">
                    {(director.responsabilidades ?? []).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/40 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(director.kpis ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-accent/60" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">KPIs</p>
                  </div>
                  <ul className="space-y-1 pl-5">
                    {(director.kpis ?? []).map((k, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-secondary/40 flex-shrink-0" />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {((director.assignedClients ?? []).length > 0 || (director.assignedProjects ?? []).length > 0) && (
                <div className="space-y-2">
                  {(director.assignedClients ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Clientes</p>
                      <div className="flex flex-wrap gap-1">
                        {(director.assignedClients ?? []).map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(director.assignedProjects ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Proyectos</p>
                      <div className="flex flex-wrap gap-1">
                        {(director.assignedProjects ?? []).map((p) => (
                          <Badge key={p.id} variant="outline" className="text-[10px]">{p.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Ver Equipo button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-auto text-xs gap-1.5 opacity-50 cursor-not-allowed"
            disabled
          >
            <Users className="h-3.5 w-3.5" />
            Ver Equipo
            <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1 border-dashed">Próx.</Badge>
          </Button>
        </CardContent>
      </Card>

      {editOpen && (
        <DirectorEditDialog
          director={director}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          clients={clients}
          projects={projects}
        />
      )}
    </>
  );
}

export function Organizacion() {
  const { user } = useAuth();
  const isCeo = user?.role === "ceo";
  const isAdmin = user?.role === "admin";
  const canEdit = isCeo || isAdmin;

  const { data: directors, isLoading } = useListDirectors();
  const { data: clientsRaw } = useListClients({});
  const { data: projectsRaw } = useListProjects({});

  const clients = (clientsRaw ?? []).map((c) => ({ id: c.id, name: c.name }));
  const projects = (projectsRaw ?? []).map((p) => ({ id: p.id, name: p.name }));

  const totalAgents = (directors ?? []).reduce((acc, d) => acc + (d.agentCount ?? 0), 0);
  const totalAutomations = (directors ?? []).reduce((acc, d) => acc + (d.automationCount ?? 0), 0);
  const active = (directors ?? []).filter((d) => d.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Network className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organización</h1>
          <p className="text-sm text-muted-foreground">Estructura organizacional de COIMAGEN Media Agency</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Directores Activos", value: active, icon: Shield },
          { label: "Agentes IA", value: totalAgents, icon: Bot },
          { label: "Automatizaciones", value: totalAutomations, icon: Zap },
          { label: "Niveles Jerárquicos", value: 3, icon: Network },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
                <Icon className="h-7 w-7 text-primary/20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Organigrama */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Organigrama
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando estructura...</div>
          ) : (
            <OrgChart directors={directors ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Director cards grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Consejo de Directores
        </h2>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Cargando directores...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(directors ?? []).map((director) => (
              <DirectorCard
                key={director.id}
                director={director}
                canEdit={canEdit}
                clients={clients}
                projects={projects}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
