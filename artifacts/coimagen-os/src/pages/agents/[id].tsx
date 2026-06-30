import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAgent, getGetAgentQueryKey,
  getListAgentsQueryKey,
  useUpdateAgent,
  useCreateAgentPromptVersion, getListAgentPromptVersionsQueryKey,
  useAssignAgentClient, useUnassignAgentClient,
  useAssignAgentProject, useUnassignAgentProject,
  useListClients, getListClientsQueryKey,
  useListProjects, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Bot, ArrowLeft, ChevronRight, Globe2, User, Zap, CheckSquare,
  BarChart3, FileText, ScrollText, Clock, Cpu, Plus, X, Save,
  AlertCircle, Lock,
} from "lucide-react";
import {
  CATEGORIES, AI_MODELS, TOOLS_CATALOG, PRIORITY_CONFIG, STATUS_CONFIG,
  CATEGORY_COLOR,
} from "./constants";

type Agent = {
  id: number;
  name: string;
  role: string;
  category?: string | null;
  world?: string | null;
  mundoId?: number | null;
  mundoName?: string | null;
  directorId?: number | null;
  directorName?: string | null;
  specialty?: string | null;
  objetivo?: string | null;
  status: string;
  priority: string;
  aiModel?: string | null;
  description?: string | null;
  promptMaster?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  toolsList?: string[];
  kpisList?: string[];
  documentation?: string | null;
  dependencies?: string[];
  assignedClients?: { id: number; name: string }[];
  assignedProjects?: { id: number; name: string }[];
  promptVersions?: {
    id: number; agentId: number; promptText: string;
    version: number; notes?: string | null; createdAt: string;
  }[];
  createdAt: string;
  updatedAt?: string | null;
};

// ─── General Tab ─────────────────────────────────────────────────────────────
function GeneralTab({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: agent.name,
    role: agent.role,
    category: agent.category ?? "",
    specialty: agent.specialty ?? "",
    objetivo: agent.objetivo ?? "",
    description: agent.description ?? "",
    status: agent.status,
    priority: agent.priority,
    aiModel: agent.aiModel ?? "",
    inputs: agent.inputs ?? "",
    outputs: agent.outputs ?? "",
    dependencies: (agent.dependencies ?? []).join(", "),
  });

  const { mutate: update, isPending } = useUpdateAgent({
    mutation: { onSuccess: () => { setEditing(false); onRefresh(); } },
  });

  const handleSave = () => {
    update({
      id: agent.id,
      data: {
        name: form.name,
        role: form.role,
        category: form.category || undefined,
        specialty: form.specialty || undefined,
        objetivo: form.objetivo || undefined,
        description: form.description || undefined,
        status: form.status as "active" | "inactive" | "paused",
        priority: form.priority as "low" | "medium" | "high" | "critical",
        aiModel: form.aiModel || undefined,
        inputs: form.inputs || undefined,
        outputs: form.outputs || undefined,
        dependencies: form.dependencies ? form.dependencies.split(",").map((s) => s.trim()).filter(Boolean) : [],
      },
    });
  };

  const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive;
  const priority = PRIORITY_CONFIG[agent.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Nombre", value: agent.name },
            { label: "Rol", value: agent.role, mono: true },
            { label: "Categoría", value: agent.category },
            { label: "Especialidad", value: agent.specialty },
            { label: "Estado", value: status.label },
            { label: "Prioridad", value: `${priority.label} (${agent.priority})` },
            { label: "Modelo IA", value: AI_MODELS.find((m) => m.id === agent.aiModel)?.name ?? agent.aiModel },
            { label: "Mundo", value: agent.mundoName },
            { label: "Director", value: agent.directorName },
          ].map(({ label, value, mono }) => (
            <div key={label} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={`text-sm ${!value ? "text-muted-foreground/40 italic" : ""} ${mono ? "font-mono" : ""}`}>
                {value ?? "—"}
              </p>
            </div>
          ))}
          {agent.objetivo && (
            <div className="md:col-span-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.objetivo}</p>
            </div>
          )}
          {agent.description && (
            <div className="md:col-span-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
            </div>
          )}
          {agent.inputs && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Entradas</p>
              <p className="text-sm text-muted-foreground">{agent.inputs}</p>
            </div>
          )}
          {agent.outputs && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Salidas</p>
              <p className="text-sm text-muted-foreground">{agent.outputs}</p>
            </div>
          )}
          {(agent.dependencies ?? []).length > 0 && (
            <div className="md:col-span-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dependencias</p>
              <div className="flex flex-wrap gap-1">
                {(agent.dependencies ?? []).map((dep, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{dep}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/50 pt-2 border-t border-border/30">
          Creado {new Date(agent.createdAt).toLocaleDateString("es-MX", { dateStyle: "long" })}
          {agent.updatedAt && ` · Actualizado ${new Date(agent.updatedAt).toLocaleDateString("es-MX", { dateStyle: "long" })}`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre *</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Rol *</Label>
          <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Especialidad</Label>
          <Input value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
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
          <Label>Modelo IA</Label>
          <Select value={form.aiModel} onValueChange={(v) => setForm((f) => ({ ...f, aiModel: v }))}>
            <SelectTrigger><SelectValue placeholder="Sin modelo" /></SelectTrigger>
            <SelectContent>{AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} — {m.provider}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Dependencias <span className="text-[10px] text-muted-foreground">(separadas por coma)</span></Label>
          <Input value={form.dependencies} onChange={(e) => setForm((f) => ({ ...f, dependencies: e.target.value }))} placeholder="Agente A, Agente B" />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>Objetivo</Label>
          <Input value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>Descripción</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Entradas</Label>
          <Input value={form.inputs} onChange={(e) => setForm((f) => ({ ...f, inputs: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Salidas</Label>
          <Input value={form.outputs} onChange={(e) => setForm((f) => ({ ...f, outputs: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border/30">
        <Button variant="outline" onClick={() => setEditing(false)} disabled={isPending}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isPending || !form.name || !form.role}>
          <Save className="h-3.5 w-3.5 mr-1.5" />{isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

// ─── Prompt Tab ───────────────────────────────────────────────────────────────
function PromptTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [promptText, setPromptText] = useState(agent.promptMaster ?? "");
  const [notes, setNotes] = useState("");

  const { mutate: updateAgent, isPending: saving } = useUpdateAgent({
    mutation: { onSuccess: () => onRefresh() },
  });

  const { mutate: saveVersion, isPending: savingVersion } = useCreateAgentPromptVersion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
        queryClient.invalidateQueries({ queryKey: getListAgentPromptVersionsQueryKey(agentId) });
        setNotes("");
        onRefresh();
      },
    },
  });

  const handleSavePrompt = () => {
    updateAgent({ id: agentId, data: { promptMaster: promptText } });
    if (promptText.trim()) {
      saveVersion({ id: agentId, data: { promptText, notes: notes || undefined } });
    }
  };

  const versions = agent.promptVersions ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Prompt Maestro</Label>
          <span className="text-[10px] text-muted-foreground">{promptText.length} caracteres</span>
        </div>
        <Textarea
          rows={12}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Eres un agente especializado en... Tu objetivo es... Tus instrucciones son..."
          className="font-mono text-xs leading-relaxed resize-none"
        />
        <div className="flex items-center gap-2">
          <Input
            className="flex-1 text-xs h-8"
            placeholder="Nota sobre este cambio (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button size="sm" onClick={handleSavePrompt} disabled={saving || savingVersion || !promptText.trim()}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving || savingVersion ? "Guardando..." : "Guardar versión"}
          </Button>
        </div>
      </div>

      {versions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historial de versiones</p>
          <div className="space-y-2">
            {versions.map((v) => (
              <Card key={v.id} className="border-border/40">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] py-0">v{v.version}</Badge>
                      {v.notes && <span className="text-xs text-muted-foreground">{v.notes}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(v.createdAt).toLocaleDateString("es-MX", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3">
                    {v.promptText}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-6 mt-1.5 text-primary/60 hover:text-primary"
                    onClick={() => setPromptText(v.promptText)}
                  >
                    Restaurar esta versión
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Herramientas Tab ─────────────────────────────────────────────────────────
function HerramientasTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const { mutate: updateAgent, isPending } = useUpdateAgent({
    mutation: { onSuccess: () => onRefresh() },
  });

  const selected = new Set(agent.toolsList ?? []);

  const toggleTool = (toolId: string) => {
    const newSet = new Set(selected);
    if (newSet.has(toolId)) newSet.delete(toolId); else newSet.add(toolId);
    updateAgent({ id: agentId, data: { toolsList: [...newSet] } });
  };

  const groups = [...new Set(TOOLS_CATALOG.map((t) => t.group))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size} herramienta{selected.size !== 1 ? "s" : ""} configurada{selected.size !== 1 ? "s" : ""}
        </p>
        {isPending && <span className="text-[10px] text-muted-foreground animate-pulse">Guardando...</span>}
      </div>
      {groups.map((group) => (
        <div key={group}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {TOOLS_CATALOG.filter((t) => t.group === group).map((tool) => {
              const active = selected.has(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  disabled={isPending}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  <span className="text-base">{tool.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{tool.name}</p>
                    {active && <p className="text-[9px] text-primary/60">Configurado</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Clientes Tab ─────────────────────────────────────────────────────────────
function ClientesTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { data: allClients = [] } = useListClients({ query: { queryKey: getListClientsQueryKey(), enabled: addOpen } });
  const assignedIds = new Set((agent.assignedClients ?? []).map((c) => c.id));

  const { mutate: assign, isPending: assigning } = useAssignAgentClient({
    mutation: { onSuccess: () => { setAddOpen(false); setSelectedClientId(""); onRefresh(); queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) }); } },
  });
  const { mutate: unassign } = useUnassignAgentClient({
    mutation: { onSuccess: () => { onRefresh(); queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) }); } },
  });

  const availableClients = (allClients as { id: number; name: string }[]).filter((c) => !assignedIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{(agent.assignedClients ?? []).length} cliente{(agent.assignedClients ?? []).length !== 1 ? "s" : ""} asignado{(agent.assignedClients ?? []).length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Asignar cliente
        </Button>
      </div>
      {(agent.assignedClients ?? []).length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-lg">
          <User className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sin clientes asignados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(agent.assignedClients ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
              <span className="text-sm">{c.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => unassign({ id: agentId, clientId: c.id })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Asignar cliente</DialogTitle></DialogHeader>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
            <SelectContent>
              {availableClients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              disabled={!selectedClientId || assigning}
              onClick={() => { if (selectedClientId) assign({ id: agentId, data: { clientId: Number(selectedClientId) } }); }}
            >
              {assigning ? "Asignando..." : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Proyectos Tab ────────────────────────────────────────────────────────────
function ProyectosTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const { data: allProjects = [] } = useListProjects({}, { query: { queryKey: getListProjectsQueryKey(), enabled: addOpen } });
  const assignedIds = new Set((agent.assignedProjects ?? []).map((p) => p.id));

  const { mutate: assign, isPending: assigning } = useAssignAgentProject({
    mutation: { onSuccess: () => { setAddOpen(false); setSelectedProjectId(""); onRefresh(); queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) }); } },
  });
  const { mutate: unassign } = useUnassignAgentProject({
    mutation: { onSuccess: () => { onRefresh(); queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) }); } },
  });

  const availableProjects = (allProjects as { id: number; name: string }[]).filter((p) => !assignedIds.has(p.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{(agent.assignedProjects ?? []).length} proyecto{(agent.assignedProjects ?? []).length !== 1 ? "s" : ""} asignado{(agent.assignedProjects ?? []).length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Asignar proyecto
        </Button>
      </div>
      {(agent.assignedProjects ?? []).length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-lg">
          <CheckSquare className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sin proyectos asignados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(agent.assignedProjects ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
              <span className="text-sm">{p.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => unassign({ id: agentId, projectId: p.id })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Asignar proyecto</DialogTitle></DialogHeader>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
            <SelectContent>
              {availableProjects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              disabled={!selectedProjectId || assigning}
              onClick={() => { if (selectedProjectId) assign({ id: agentId, data: { projectId: Number(selectedProjectId) } }); }}
            >
              {assigning ? "Asignando..." : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KPIs Tab ─────────────────────────────────────────────────────────────────
function KPIsTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const [newKpi, setNewKpi] = useState("");
  const kpis = agent.kpisList ?? [];

  const { mutate: updateAgent, isPending } = useUpdateAgent({
    mutation: { onSuccess: () => onRefresh() },
  });

  const addKpi = () => {
    if (!newKpi.trim()) return;
    updateAgent({ id: agentId, data: { kpisList: [...kpis, newKpi.trim()] } });
    setNewKpi("");
  };

  const removeKpi = (i: number) => {
    updateAgent({ id: agentId, data: { kpisList: kpis.filter((_, idx) => idx !== i) } });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          className="flex-1 text-sm"
          placeholder="Tasa de conversión (%), Respuestas/hora..."
          value={newKpi}
          onChange={(e) => setNewKpi(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addKpi(); }}
        />
        <Button onClick={addKpi} disabled={!newKpi.trim() || isPending} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />Añadir
        </Button>
      </div>
      {kpis.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-lg">
          <BarChart3 className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sin KPIs definidos</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {kpis.map((kpi, i) => (
            <li key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 group">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                <span className="text-sm">{kpi}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => removeKpi(i)}
                disabled={isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Documentación Tab ────────────────────────────────────────────────────────
function DocumentacionTab({ agent, agentId, onRefresh }: { agent: Agent; agentId: number; onRefresh: () => void }) {
  const [doc, setDoc] = useState(agent.documentation ?? "");
  const { mutate: updateAgent, isPending } = useUpdateAgent({
    mutation: { onSuccess: () => onRefresh() },
  });

  return (
    <div className="space-y-3">
      <Textarea
        rows={16}
        value={doc}
        onChange={(e) => setDoc(e.target.value)}
        placeholder="Documentación del agente: guía de uso, casos de uso, ejemplos, limitaciones, historial de cambios..."
        className="text-sm leading-relaxed resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => updateAgent({ id: agentId, data: { documentation: doc } })} disabled={isPending}>
          <Save className="h-3.5 w-3.5 mr-1.5" />{isPending ? "Guardando..." : "Guardar documentación"}
        </Button>
      </div>
    </div>
  );
}

// ─── Placeholder Tab ──────────────────────────────────────────────────────────
function PlaceholderTab({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/40 rounded-xl text-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground/30" />
      </div>
      <div>
        <p className="font-semibold text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border/40 text-[10px] text-muted-foreground/50">
        <Lock className="h-2.5 w-2.5" />Próximamente
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function AgentDetail() {
  const [, params] = useRoute("/agents/:id");
  const agentId = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();

  const { data: agentData, isLoading, error } = useGetAgent(agentId, {
    query: { queryKey: getGetAgentQueryKey(agentId), enabled: agentId > 0 },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Cargando agente...</p>
      </div>
    );
  }

  if (error || !agentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Agente no encontrado</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/agents"><ArrowLeft className="h-4 w-4 mr-1.5" />Volver</Link>
        </Button>
      </div>
    );
  }

  const agent = agentData as Agent;
  const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive;
  const priority = PRIORITY_CONFIG[agent.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const catColor = agent.category ? (CATEGORY_COLOR[agent.category] ?? "") : "";
  const modelName = AI_MODELS.find((m) => m.id === agent.aiModel)?.name;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/agents" className="hover:text-foreground flex items-center gap-1">
          <Bot className="h-3 w-3" />AI Agents
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{agent.name}</span>
      </div>

      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <Badge variant="outline" className={status.class}>{status.label}</Badge>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${priority.color} bg-current/10`}>
              ● {priority.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-sm text-muted-foreground font-mono">{agent.role}</p>
            {agent.category && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${catColor}`}>{agent.category}</span>
            )}
            {modelName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40 flex items-center gap-1">
                <Cpu className="h-2.5 w-2.5" />{modelName}
              </span>
            )}
            {agent.mundoName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/70 flex items-center gap-1">
                <Globe2 className="h-2.5 w-2.5" />{agent.mundoName}
              </span>
            )}
            {agent.directorName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                <User className="h-2.5 w-2.5" />{agent.directorName}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="flex-shrink-0">
          <Link href="/agents"><ArrowLeft className="h-4 w-4 mr-1.5" />Agentes</Link>
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Herramientas", value: (agent.toolsList ?? []).length, icon: Zap },
          { label: "KPIs", value: (agent.kpisList ?? []).length, icon: BarChart3 },
          { label: "Clientes", value: (agent.assignedClients ?? []).length, icon: User },
          { label: "Versiones prompt", value: (agent.promptVersions ?? []).length, icon: ScrollText },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/40">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
                <Icon className="h-6 w-6 text-primary/15" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 10-tab panel */}
      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          {[
            { value: "general",         label: "General" },
            { value: "prompt",          label: "Prompt" },
            { value: "herramientas",    label: "Herramientas" },
            { value: "automatizaciones",label: "Automatizaciones" },
            { value: "clientes",        label: "Clientes" },
            { value: "proyectos",       label: "Proyectos" },
            { value: "kpis",            label: "KPIs" },
            { value: "logs",            label: "Logs" },
            { value: "versiones",       label: "Versiones" },
            { value: "documentacion",   label: "Documentación" },
          ].map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="text-xs">{label}</TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="general">
            <Card className="border-border/40"><CardContent className="p-5">
              <GeneralTab agent={agent} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="prompt">
            <Card className="border-border/40"><CardContent className="p-5">
              <PromptTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="herramientas">
            <Card className="border-border/40"><CardContent className="p-5">
              <HerramientasTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="automatizaciones">
            <PlaceholderTab
              icon={Zap}
              title="Automatizaciones"
              description="Flujos y workflows asociados a este agente"
            />
          </TabsContent>

          <TabsContent value="clientes">
            <Card className="border-border/40"><CardContent className="p-5">
              <ClientesTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="proyectos">
            <Card className="border-border/40"><CardContent className="p-5">
              <ProyectosTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="kpis">
            <Card className="border-border/40"><CardContent className="p-5">
              <KPIsTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="logs">
            <PlaceholderTab
              icon={Clock}
              title="Logs de actividad"
              description="Historial de ejecuciones, errores y eventos del agente"
            />
          </TabsContent>

          <TabsContent value="versiones">
            <Card className="border-border/40"><CardContent className="p-5">
              {(agent.promptVersions ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <ScrollText className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sin versiones guardadas. Edita el prompt para crear la primera versión.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(agent.promptVersions ?? []).map((v) => (
                    <Card key={v.id} className="border-border/30">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">v{v.version}</Badge>
                            {v.notes && <span className="text-xs text-muted-foreground">{v.notes}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.createdAt).toLocaleString("es-MX")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono leading-relaxed line-clamp-4">
                          {v.promptText}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="documentacion">
            <Card className="border-border/40"><CardContent className="p-5">
              <DocumentacionTab agent={agent} agentId={agentId} onRefresh={refresh} />
            </CardContent></Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
