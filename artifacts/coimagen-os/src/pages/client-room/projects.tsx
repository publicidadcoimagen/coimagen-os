import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListProjects, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Calendar, TrendingUp, User } from "lucide-react";

type Org = { id: number; slug: string; name: string; clientId?: number | null };
type Project = {
  id: number; name: string; description?: string | null; status: string;
  priority: string; dueDate?: string | null; clientId?: number | null; createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  planning:    "bg-blue-400/15 text-blue-400 border-blue-400/30",
  active:      "bg-green-400/15 text-green-400 border-green-400/30",
  in_progress: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  on_hold:     "bg-orange-400/15 text-orange-400 border-orange-400/30",
  completed:   "bg-slate-400/15 text-slate-400 border-slate-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planeación", active: "Activo", in_progress: "En progreso",
  on_hold: "En pausa", completed: "Completado",
};

export function ClientProjects() {
  const [, params] = useRoute("/client/:slug/projects");
  const slug = params?.slug ?? "";

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: rawProjects = [], isLoading } = useListProjects(
    {},
    { query: { queryKey: getListProjectsQueryKey({}) } },
  );

  const projects = (rawProjects as Project[]).filter((p) => org?.clientId ? p.clientId === org.clientId : false);

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Proyectos</h1>
            <p className="text-sm text-muted-foreground">{projects.length} proyecto{projects.length !== 1 ? "s" : ""} activo{projects.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array(2).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-24 bg-muted/20" /></Card>)}</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
            <FolderKanban className="h-10 w-10 opacity-20" />
            <p className="text-sm">No hay proyectos registrados para esta organización</p>
            {!org?.clientId && <p className="text-[11px]">Vincula un cliente en la configuración del Client Room</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold">{project.name}</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_COLOR[project.status] ?? ""}`}>
                          {STATUS_LABEL[project.status] ?? project.status}
                        </Badge>
                      </div>
                      {project.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{project.description}</p>}
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        {project.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Entrega: {new Date(project.dueDate).toLocaleDateString("es-MX")}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span>Prioridad: {project.priority}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>COIMAGEN Media</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClientRoomLayout>
  );
}
