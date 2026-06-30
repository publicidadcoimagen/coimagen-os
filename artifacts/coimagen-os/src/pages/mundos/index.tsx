import { useListMundos, getListMundosQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe2, Bot, Zap, CheckSquare, Crown, Cpu, ArrowRight, Users, FolderKanban, ChevronRight } from "lucide-react";

type Mundo = {
  id: number;
  key: string;
  name: string;
  emoji: string;
  description?: string | null;
  objetivo?: string | null;
  status: string;
  agentCount?: number;
  automationCount?: number;
  taskCount?: number;
  assignedClients?: { id: number; name: string }[];
  assignedProjects?: { id: number; name: string }[];
  director?: { id: number; name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-400/15 text-green-400 border-green-400/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

function HierarchyNav({ mundos }: { mundos: Mundo[] }) {
  return (
    <div className="flex flex-col items-center gap-0">
      {/* Level 1: CEO */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-primary/50 bg-primary/10 shadow-lg shadow-primary/10">
          <Crown className="h-4 w-4 text-primary" />
          <div className="text-center">
            <p className="text-xs font-bold text-primary tracking-widest uppercase">CEO</p>
            <p className="text-[10px] text-primary/60">Camila Segovia</p>
          </div>
        </div>
        <div className="w-px h-5 bg-border" />
      </div>

      {/* Level 2: CORE AI */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-secondary/50 bg-secondary/10 shadow-md shadow-secondary/5">
          <Cpu className="h-4 w-4 text-secondary" />
          <div className="text-center">
            <p className="text-xs font-bold text-secondary tracking-widest uppercase">CORE AI</p>
            <p className="text-[10px] text-secondary/60">Núcleo de Inteligencia</p>
          </div>
        </div>
        <div className="w-px h-5 bg-border" />
      </div>

      {/* Level 3: All Mundos label */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 px-5 py-2 rounded-lg border border-border/60 bg-muted/30">
          <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            {mundos.length} Mundos Activos
          </p>
        </div>
        {/* Horizontal branch line */}
        <div className="relative mt-1 w-full flex justify-center">
          <div className="w-px h-4 bg-border" />
        </div>
      </div>
    </div>
  );
}

function MundoCard({ mundo }: { mundo: Mundo }) {
  const clients = mundo.assignedClients ?? [];
  const projects = mundo.assignedProjects ?? [];

  return (
    <Link href={`/mundos/${mundo.id}`}>
      <Card className="border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer group h-full">
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{mundo.emoji}</span>
              <div>
                <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                  {mundo.name}
                </p>
                {mundo.director && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Dir. {mundo.director.name.replace("Director ", "")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_COLORS[mundo.status] ?? ""}`}>
                {mundo.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
            </div>
          </div>

          {/* Description */}
          {mundo.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
              {mundo.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Bot, label: "Agentes", value: mundo.agentCount ?? 0 },
              { icon: Zap, label: "Automations", value: mundo.automationCount ?? 0 },
              { icon: CheckSquare, label: "Tareas", value: mundo.taskCount ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center p-1.5 rounded-md bg-muted/30">
                <Icon className="h-3 w-3 text-primary/40 mx-auto mb-0.5" />
                <p className="text-sm font-bold">{value}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Clients/Projects */}
          {(clients.length > 0 || projects.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {clients.slice(0, 2).map((c) => (
                <Badge key={c.id} variant="outline" className="text-[10px] gap-1 py-0">
                  <Users className="h-2.5 w-2.5" />{c.name}
                </Badge>
              ))}
              {clients.length > 2 && (
                <Badge variant="outline" className="text-[10px] py-0">+{clients.length - 2}</Badge>
              )}
              {projects.slice(0, 1).map((p) => (
                <Badge key={p.id} variant="outline" className="text-[10px] gap-1 py-0">
                  <FolderKanban className="h-2.5 w-2.5" />{p.name}
                </Badge>
              ))}
            </div>
          )}

          {/* CTA */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5 mt-auto group-hover:bg-primary/10 group-hover:border-primary/30 group-hover:text-primary transition-colors"
            asChild
          >
            <span>
              <Globe2 className="h-3.5 w-3.5" />
              Entrar al Mundo
              <ArrowRight className="h-3 w-3 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </span>
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

export function Mundos() {
  const { data: mundos, isLoading } = useListMundos();

  const active = (mundos ?? []).filter((m) => m.status === "active").length;
  const totalAgents = (mundos ?? []).reduce((a, m) => a + (m.agentCount ?? 0), 0);
  const totalAutomations = (mundos ?? []).reduce((a, m) => a + (m.automationCount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mundos</h1>
          <p className="text-sm text-muted-foreground">Universos operativos de COIMAGEN Media Agency</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Mundos Activos", value: active },
          { label: "Agentes Totales", value: totalAgents },
          { label: "Automatizaciones", value: totalAutomations },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hierarchy nav */}
      <Card className="border-border/50">
        <CardContent className="pt-5 pb-5">
          <HierarchyNav mundos={mundos ?? []} />
        </CardContent>
      </Card>

      {/* Mundos grid */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Todos los Mundos
        </h2>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm animate-pulse">Cargando Mundos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {(mundos ?? []).map((m) => (
              <MundoCard key={m.id} mundo={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
