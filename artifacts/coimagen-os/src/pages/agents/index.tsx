import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListAgents, getListAgentsQueryKey, useCreateAgent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Bot, Plus, Search, ChevronRight, Zap, BarChart3, Globe2, User,
} from "lucide-react";
import {
  CATEGORIES, AI_MODELS, PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_COLOR,
} from "./constants";

type AgentItem = {
  id: number;
  name: string;
  role: string;
  category?: string | null;
  status: string;
  priority: string;
  aiModel?: string | null;
  description?: string | null;
  mundoName?: string | null;
  directorName?: string | null;
  toolsList?: string[];
  kpisList?: string[];
  specialty?: string | null;
  createdAt: string;
};

const SORT_OPTIONS = [
  { value: "name", label: "Nombre A-Z" },
  { value: "priority", label: "Prioridad" },
  { value: "created", label: "Más recientes" },
  { value: "status", label: "Estado" },
];

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function AgentCard({ agent }: { agent: AgentItem }) {
  const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive;
  const priority = PRIORITY_CONFIG[agent.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const catColor = agent.category ? (CATEGORY_COLOR[agent.category] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer group h-full">
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4.5 w-4.5 text-primary" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${priority.dot}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
                  {agent.name}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{agent.role}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] py-0 flex-shrink-0 ${status.class}`}>
              {status.label}
            </Badge>
          </div>

          {/* Category + Model */}
          <div className="flex flex-wrap gap-1">
            {agent.category && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${catColor}`}>
                {agent.category}
              </span>
            )}
            {agent.aiModel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                {AI_MODELS.find((m) => m.id === agent.aiModel)?.name ?? agent.aiModel}
              </span>
            )}
            {agent.mundoName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/70 flex items-center gap-0.5">
                <Globe2 className="h-2.5 w-2.5" />{agent.mundoName}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1 min-h-[32px]">
            {agent.description ?? "Sin descripción."}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" />{(agent.toolsList ?? []).length} herramientas
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-2.5 w-2.5" />{(agent.kpisList ?? []).length} KPIs
            </span>
            {agent.specialty && (
              <span className="truncate">{agent.specialty}</span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-primary transition-colors pt-1 border-t border-border/30">
            <span>Abrir agente</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState<string>("");
  const [aiModel, setAiModel] = useState<string>("");

  const { mutate: createAgent, isPending } = useCreateAgent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        setName(""); setRole(""); setCategory(""); setAiModel("");
        onClose();
      },
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !role.trim()) return;
    createAgent({
      data: {
        name: name.trim(),
        role: role.trim(),
        category: category || undefined,
        aiModel: aiModel || undefined,
        status: "active",
        priority: "medium",
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />Nuevo Agente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input placeholder="Agente Comercial Alpha" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <Input placeholder="sales-agent-alpha" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo IA</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim() || !role.trim()}>
            {isPending ? "Creando..." : "Crear Agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Agents() {
  const { data: agents = [], isLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey() },
  });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [createOpen, setCreateOpen] = useState(false);

  const typedAgents = agents as AgentItem[];

  const filtered = useMemo(() => {
    let result = typedAgents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      );
    }
    if (activeCategory !== "Todos") {
      result = result.filter((a) => a.category === activeCategory);
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (modelFilter !== "all") {
      result = result.filter((a) => a.aiModel === modelFilter);
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "priority") return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [typedAgents, search, activeCategory, statusFilter, modelFilter, sortBy]);

  const counts = useMemo(() => ({
    total: typedAgents.length,
    active: typedAgents.filter((a) => a.status === "active").length,
    paused: typedAgents.filter((a) => a.status === "paused").length,
    critical: typedAgents.filter((a) => a.priority === "critical").length,
  }), [typedAgents]);

  const allCategories = ["Todos", ...CATEGORIES];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-sm text-muted-foreground">Centro de administración de agentes — COIMAGEN OS</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nuevo Agente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Agentes", value: counts.total },
          { label: "Activos", value: counts.active },
          { label: "Pausados", value: counts.paused },
          { label: "Prioridad Crítica", value: counts.critical },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 flex-wrap">
        {allCategories.map((cat) => {
          const count = cat === "Todos" ? typedAgents.length : typedAgents.filter((a) => a.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {cat}
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] ${activeCategory === cat ? "opacity-70" : "opacity-50"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Modelo IA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los modelos</SelectItem>
            {AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} agente{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        {activeCategory !== "Todos" && ` en ${activeCategory}`}
      </p>

      {/* Agent grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-border/30">
              <CardContent className="h-44 bg-muted/20 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl text-muted-foreground gap-3">
          <Bot className="h-10 w-10 opacity-20" />
          <p className="text-sm">No se encontraron agentes</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setActiveCategory("Todos"); setStatusFilter("all"); setModelFilter("all"); }}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      )}

      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
