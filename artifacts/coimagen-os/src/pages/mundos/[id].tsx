import { useRoute, Link } from "wouter";
import { useGetMundo, getGetMundoQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe2, Bot, Zap, CheckSquare, BarChart3, FileText,
  ArrowLeft, Crown, ChevronRight, Users, FolderKanban,
  Target, Shield, User, Lock, Cpu,
} from "lucide-react";

type MundoDetail = {
  id: number;
  key: string;
  name: string;
  emoji: string;
  description?: string | null;
  objetivo?: string | null;
  kpis?: string[];
  status: string;
  agentCount?: number;
  automationCount?: number;
  taskCount?: number;
  assignedClients?: { id: number; name: string }[];
  assignedProjects?: { id: number; name: string }[];
  director?: {
    id: number;
    key: string;
    name: string;
    description?: string | null;
    objetivo?: string | null;
    responsabilidades?: string[];
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-400/15 text-green-400 border-green-400/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

type StructureSection = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  count?: number;
  color: string;
  ready: boolean;
};

function StructureCard({ section }: { section: StructureSection }) {
  return (
    <Card className={`border-border/50 ${!section.ready ? "opacity-70" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg ${section.color} flex items-center justify-center`}>
              <section.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{section.title}</p>
              <p className="text-[10px] text-muted-foreground">{section.description}</p>
            </div>
          </div>
          {section.count !== undefined && (
            <span className="text-2xl font-bold text-muted-foreground/50">{section.count}</span>
          )}
        </div>
        {!section.ready ? (
          <div className="flex items-center gap-1.5 py-2 px-3 rounded-md bg-muted/30 border border-dashed border-border">
            <Lock className="h-3 w-3 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground/50">Estructura preparada — próximamente</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DirectorSection({ director }: { director: NonNullable<MundoDetail["director"]> }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{director.name}</p>
            {director.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{director.description}</p>
            )}
            {director.objetivo && (
              <div className="mt-2 flex items-start gap-1.5">
                <Target className="h-3 w-3 text-primary/60 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{director.objetivo}</p>
              </div>
            )}
            {(director.responsabilidades ?? []).length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Responsabilidades</p>
                <ul className="space-y-0.5">
                  {(director.responsabilidades ?? []).slice(0, 3).map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/40 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                  {(director.responsabilidades ?? []).length > 3 && (
                    <li className="text-[10px] text-muted-foreground/60 pl-2.5">
                      +{(director.responsabilidades ?? []).length - 3} más...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MundoDetail() {
  const [, params] = useRoute("/mundos/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: mundo, isLoading, error } = useGetMundo(id, {
    query: { queryKey: getGetMundoQueryKey(id), enabled: id > 0 },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-sm animate-pulse">Cargando Mundo...</p>
      </div>
    );
  }

  if (error || !mundo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Globe2 className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">Mundo no encontrado</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/mundos"><ArrowLeft className="h-4 w-4 mr-1.5" />Volver</Link>
        </Button>
      </div>
    );
  }

  const m = mundo as MundoDetail;
  const clients = m.assignedClients ?? [];
  const projects = m.assignedProjects ?? [];

  const INTERNAL_STRUCTURE: StructureSection[] = [
    {
      icon: Bot,
      title: "Agentes",
      description: "Agentes de IA asignados a este Mundo",
      count: m.agentCount ?? 0,
      color: "bg-primary/20 text-primary",
      ready: false,
    },
    {
      icon: Zap,
      title: "Automatizaciones",
      description: "Flujos y workflows activos",
      count: m.automationCount ?? 0,
      color: "bg-secondary/20 text-secondary",
      ready: false,
    },
    {
      icon: CheckSquare,
      title: "Tareas",
      description: "Tareas y sprints del Mundo",
      count: m.taskCount ?? 0,
      color: "bg-accent/20 text-accent",
      ready: false,
    },
    {
      icon: BarChart3,
      title: "KPIs",
      description: `${(m.kpis ?? []).length} indicadores definidos`,
      color: "bg-green-400/20 text-green-400",
      ready: (m.kpis ?? []).length > 0,
    },
    {
      icon: FileText,
      title: "Documentación",
      description: "Manuales, SOPs y recursos",
      count: 0,
      color: "bg-orange-400/20 text-orange-400",
      ready: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/mundos" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Globe2 className="h-3 w-3" />Mundos
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{m.name}</span>
      </div>

      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl flex-shrink-0">
            {m.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{m.name}</h1>
              <Badge variant="outline" className={`${STATUS_COLORS[m.status] ?? ""}`}>
                {m.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            {m.objetivo && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{m.objetivo}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="flex-shrink-0">
          <Link href="/mundos"><ArrowLeft className="h-4 w-4 mr-1.5" />Mundos</Link>
        </Button>
      </div>

      {/* Hierarchy breadcrumb visual */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 text-xs">
        <Crown className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">CEO</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <Cpu className="h-3.5 w-3.5 text-secondary" />
        <span className="text-muted-foreground">CORE AI</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <Globe2 className="h-3.5 w-3.5 text-primary" />
        <Link href="/mundos" className="text-muted-foreground hover:text-foreground">Mundos</Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <span className="font-semibold text-foreground">{m.name}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Agentes", value: m.agentCount ?? 0, icon: Bot },
          { label: "Automatizaciones", value: m.automationCount ?? 0, icon: Zap },
          { label: "Tareas", value: m.taskCount ?? 0, icon: CheckSquare },
          { label: "KPIs definidos", value: (m.kpis ?? []).length, icon: BarChart3 },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Director + Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Director */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Director Responsable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {m.director ? (
                <DirectorSection director={m.director} />
              ) : (
                <div className="text-center py-4">
                  <User className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sin director asignado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clients & Projects */}
          {(clients.length > 0 || projects.length > 0) && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Relaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clients.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      <Users className="h-3 w-3 inline mr-1" />Clientes
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {clients.map((c) => (
                        <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {projects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      <FolderKanban className="h-3 w-3 inline mr-1" />Proyectos
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {projects.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          {(m.kpis ?? []).length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  KPIs del Mundo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {(m.kpis ?? []).map((kpi, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      {kpi}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Internal Structure */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Estructura Interna del Mundo
            </h2>

            {/* Director layer */}
            <div className="flex flex-col items-start gap-0 mb-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs font-semibold text-primary">
                <User className="h-3.5 w-3.5" />
                Director
                <span className="ml-2 font-normal text-primary/70">
                  {m.director?.name ?? "—"}
                </span>
              </div>
              <div className="ml-4 w-px h-3 bg-border" />
            </div>

            <div className="space-y-2">
              {INTERNAL_STRUCTURE.map((section, i) => (
                <div key={section.title} className="flex flex-col items-start gap-0">
                  <StructureCard section={section} />
                  {i < INTERNAL_STRUCTURE.length - 1 && (
                    <div className="ml-8 w-px h-2 bg-border" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {m.description && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
