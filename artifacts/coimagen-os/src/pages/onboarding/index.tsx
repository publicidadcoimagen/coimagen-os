import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListSmartOnboardings,
  getListSmartOnboardingsQueryKey,
  useCreateSmartOnboarding,
  useDeleteSmartOnboarding,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ClipboardList, Plus, ChevronRight, Trash2, CheckCircle2,
  Clock, FileEdit, Users, Building2,
} from "lucide-react";

type SmartOnboarding = {
  id: number;
  status: string;
  currentStep: number;
  step1?: { companyName?: string; contactName?: string; industry?: string } | null;
  completedEntities?: { clientName?: string; projectName?: string } | null;
  clientId?: number | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

const TOTAL_STEPS = 7;
const STEP_LABELS = [
  "Información General",
  "Servicios",
  "Objetivos",
  "Accesos",
  "Branding",
  "Documentación",
  "Asignación",
];

const STATUS_CONFIG = {
  draft:       { label: "Borrador",    class: "bg-muted text-muted-foreground border-border/50",           icon: FileEdit },
  in_progress: { label: "En proceso",  class: "bg-blue-400/15 text-blue-400 border-blue-400/30",           icon: Clock },
  completed:   { label: "Completado",  class: "bg-green-400/15 text-green-400 border-green-400/30",        icon: CheckCircle2 },
};

function getProgress(ob: SmartOnboarding): number {
  if (ob.status === "completed") return 100;
  return Math.round(((ob.currentStep - 1) / TOTAL_STEPS) * 100);
}

function getDisplayName(ob: SmartOnboarding): string {
  if (ob.completedEntities?.clientName) return ob.completedEntities.clientName;
  if (ob.step1?.companyName) return ob.step1.companyName;
  if (ob.step1?.contactName) return ob.step1.contactName;
  return `Onboarding #${ob.id}`;
}

export function SmartOnboardingList() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useListSmartOnboardings({
    query: { queryKey: getListSmartOnboardingsQueryKey() },
  });

  const { mutate: createOb, isPending: creating } = useCreateSmartOnboarding({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListSmartOnboardingsQueryKey() });
        navigate(`/onboarding/${(data as SmartOnboarding).id}`);
      },
    },
  });

  const { mutate: deleteOb } = useDeleteSmartOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSmartOnboardingsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const onboardings = rows as SmartOnboarding[];
  const stats = {
    total: onboardings.length,
    drafts: onboardings.filter((o) => o.status === "draft").length,
    inProgress: onboardings.filter((o) => o.status === "in_progress").length,
    completed: onboardings.filter((o) => o.status === "completed").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Smart Client Onboarding</h1>
            <p className="text-sm text-muted-foreground">Punto de entrada oficial para todos los nuevos clientes</p>
          </div>
        </div>
        <Button onClick={() => createOb()} disabled={creating}>
          <Plus className="h-4 w-4 mr-1.5" />{creating ? "Creando..." : "Nuevo Onboarding"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: ClipboardList },
          { label: "Borradores", value: stats.drafts, icon: FileEdit },
          { label: "En proceso", value: stats.inProgress, icon: Clock },
          { label: "Completados", value: stats.completed, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/50">
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

      {/* Intro card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Flujo de 7 etapas</strong> — El Smart Onboarding captura toda la información del cliente y al finalizar crea automáticamente el perfil, proyecto, backlog y relaciones en el sistema.
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-border/30">
              <CardContent className="h-20 bg-muted/20 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : onboardings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-20" />
          <p className="text-sm">No hay onboardings registrados</p>
          <Button variant="outline" size="sm" onClick={() => createOb()} disabled={creating}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Iniciar primer onboarding
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {onboardings.map((ob) => {
            const status = STATUS_CONFIG[ob.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
            const StatusIcon = status.icon;
            const progress = getProgress(ob);
            const name = getDisplayName(ob);

            return (
              <Card key={ob.id} className="border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ob.status === "completed" ? "bg-green-400/10" : "bg-muted/30"
                    }`}>
                      <StatusIcon className={`h-5 w-5 ${ob.status === "completed" ? "text-green-400" : "text-muted-foreground"}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{name}</span>
                        <Badge variant="outline" className={`text-[10px] py-0 ${status.class}`}>
                          {status.label}
                        </Badge>
                        {ob.step1?.industry && (
                          <span className="text-[10px] text-muted-foreground">{ob.step1.industry}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1 max-w-[200px]" />
                        <span className="text-[10px] text-muted-foreground">
                          {ob.status === "completed"
                            ? "Completado"
                            : `Etapa ${ob.currentStep} / ${TOTAL_STEPS} — ${STEP_LABELS[ob.currentStep - 1] ?? "Iniciando"}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {ob.updatedAt
                            ? `Actualizado ${new Date(ob.updatedAt).toLocaleDateString("es-MX")}`
                            : new Date(ob.createdAt).toLocaleDateString("es-MX")}
                        </span>
                      </div>
                      {ob.status === "completed" && ob.completedEntities && (
                        <div className="flex items-center gap-3 mt-1">
                          {ob.completedEntities.clientName && (
                            <span className="text-[10px] text-green-400 flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" />{ob.completedEntities.clientName}
                            </span>
                          )}
                          {ob.completedEntities.projectName && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-1">
                              <Building2 className="h-2.5 w-2.5" />{ob.completedEntities.projectName}
                            </span>
                          )}
                          {ob.clientId && (
                            <Link href={`/clients/${ob.clientId}`}>
                              <span className="text-[10px] text-primary hover:underline">Ver cliente →</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ob.status !== "completed" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/onboarding/${ob.id}`}>
                            Continuar<ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                      {ob.status === "completed" && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/onboarding/${ob.id}`}>
                            Ver resumen<ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(ob.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El onboarding y todos sus datos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteOb({ id: deleteId }); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
