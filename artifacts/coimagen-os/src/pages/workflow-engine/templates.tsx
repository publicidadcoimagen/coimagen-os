import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWorkflowTemplates,
  getListWorkflowTemplatesQueryKey,
  useDeleteWorkflowTemplate,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GitBranch, ChevronRight, ArrowLeft, Star, Trash2, Layers } from "lucide-react";

type Template = {
  id: number; name: string; description?: string | null; product?: string | null;
  stages: string[]; defaultPriority: string; isDefault: boolean; createdAt: string;
};

const STAGE_LABELS: Record<string, string> = {
  lead_received:"Lead recibido", diagnosis_started:"Diagnóstico iniciado",
  diagnosis_completed:"Diagnóstico completado", proposal_sent:"Propuesta enviada",
  proposal_approved:"Propuesta aprobada", contract_sent:"Contrato enviado",
  contract_signed:"Contrato firmado", payment_received:"Pago inicial recibido",
  onboarding_started:"Onboarding iniciado", onboarding_completed:"Onboarding completado",
  production_started:"Producción iniciada", design_review:"Diseño en revisión",
  development_review:"Desarrollo en revisión", qa_internal:"QA interno",
  changes_requested:"Cambios solicitados", client_approval:"Aprobación cliente",
  final_delivery:"Entrega final", monthly_active:"Mensualidad activa",
  support_active:"Soporte activo", customer_success:"Customer Success",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-400/15 text-slate-400", medium: "bg-blue-400/15 text-blue-400",
  high: "bg-orange-400/15 text-orange-400", critical: "bg-red-400/15 text-red-400",
};

export function WorkflowTemplates() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: rawTemplates = [], isLoading } = useListWorkflowTemplates({
    query: { queryKey: getListWorkflowTemplatesQueryKey() },
  });

  const { mutate: deleteTemplate } = useDeleteWorkflowTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowTemplatesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const templates = rawTemplates as Template[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
            <Link href="/workflow-engine"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Plantillas de Workflow</h1>
              <p className="text-sm text-muted-foreground">Plantillas reutilizables por producto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2">
          <GitBranch className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Las plantillas se generan automáticamente con las <strong className="text-foreground">20 etapas base</strong> del proceso operativo de Coimagen. Cada producto tiene su propia plantilla configurable.
          </p>
        </CardContent>
      </Card>

      {/* Templates list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(6).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16 bg-muted/20" /></Card>)}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-16 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <Layers className="h-10 w-10 opacity-20" />
          <p className="text-sm">Las plantillas se cargarán automáticamente</p>
          <p className="text-xs opacity-60">Navega a Workflows → abre la lista para inicializar las plantillas por defecto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => {
            const isExpanded = expanded === tmpl.id;
            return (
              <Card key={tmpl.id} className="border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{tmpl.name}</span>
                        {tmpl.isDefault && (
                          <Badge variant="outline" className="text-[10px] py-0 bg-amber-400/10 text-amber-400 border-amber-400/30">
                            <Star className="h-2.5 w-2.5 mr-0.5" />Oficial
                          </Badge>
                        )}
                        {tmpl.product && (
                          <Badge variant="outline" className="text-[10px] py-0 bg-muted/20 text-muted-foreground">
                            {tmpl.product}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] py-0 ${PRIORITY_COLORS[tmpl.defaultPriority] ?? ""}`}>
                          Prioridad {tmpl.defaultPriority}
                        </Badge>
                      </div>
                      {tmpl.description && <p className="text-xs text-muted-foreground mb-1">{tmpl.description}</p>}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{tmpl.stages.length} etapas</span>
                        <button
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          onClick={() => setExpanded(isExpanded ? null : tmpl.id)}
                        >
                          {isExpanded ? "Ocultar" : "Ver etapas"}
                          <ChevronRight className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tmpl.stages.map((s, i) => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 bg-muted/20 text-muted-foreground">
                              {i + 1}. {STAGE_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!tmpl.isDefault && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(tmpl.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. La plantilla será eliminada permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteTemplate({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
