import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrchestrationRules, getListOrchestrationRulesQueryKey,
  useCreateOrchestrationRule, useUpdateOrchestrationRule,
  useDeleteOrchestrationRule,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GitBranch, Plus, Trash2, Edit2, ArrowRight, Zap } from "lucide-react";
import { EVENT_CATALOG, getEventLabel } from "./catalog";

type ORule = {
  id: number; name: string; description?: string | null; triggerEvent: string;
  condition?: string | null; actions?: string | null; status: string;
  executionCount: number; lastExecutedAt?: string | null; createdAt: string;
};

function RuleDialog({ rule, open, onClose }: {
  rule?: ORule; open: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!rule;
  const [name, setName]               = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [triggerEvent, setTrigger]    = useState(rule?.triggerEvent ?? "contrato_firmado");
  const [condition, setCondition]     = useState(rule?.condition ?? "");
  const [actions, setActions]         = useState(rule?.actions ?? "");
  const [status, setStatus]           = useState(rule?.status ?? "active");

  const { mutate: create, isPending: creating } = useCreateOrchestrationRule({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrchestrationRulesQueryKey({}) }); onClose(); } },
  });
  const { mutate: update, isPending: updating } = useUpdateOrchestrationRule({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrchestrationRulesQueryKey({}) }); onClose(); } },
  });

  const isPending = creating || updating;

  function handleSave() {
    const data = {
      name, description: description || undefined, triggerEvent,
      condition: condition || undefined, actions: actions || undefined, status,
    };
    if (isEdit && rule) {
      update({ id: rule.id, data });
    } else {
      create({ data });
    }
  }

  const suggestedActions = EVENT_CATALOG.find((e) => e.id === triggerEvent)?.suggestedActions ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />{isEdit ? "Editar regla" : "Nueva regla"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5"><Label>Nombre de la regla *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Contrato firmado → crear proyecto" autoFocus /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

          <div className="space-y-1.5">
            <Label>Evento disparador *</Label>
            <Select value={triggerEvent} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATALOG.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Condición <span className="text-muted-foreground text-[10px]">(JSON o texto libre)</span></Label>
            <Textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              rows={2}
              placeholder='{"cliente.status": "activo", "contrato.monto": "> 10000"}'
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Acciones <span className="text-muted-foreground text-[10px]">(una por línea o JSON)</span></Label>
            </div>
            <Textarea
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              rows={4}
              placeholder={suggestedActions.join("\n")}
              className="font-mono text-xs"
            />
            {suggestedActions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedActions.map((a) => (
                  <button
                    key={a}
                    className="text-[9px] px-2 py-0.5 rounded border border-primary/30 text-primary/80 hover:bg-primary/10 transition-colors"
                    onClick={() => setActions((prev) => prev ? `${prev}\n${a}` : a)}
                  >
                    + {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={status === "active"}
              onCheckedChange={(checked) => setStatus(checked ? "active" : "inactive")}
            />
            <Label>Regla {status === "active" ? "activa" : "inactiva"}</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim() || isPending}>
              {isPending ? "Guardando..." : isEdit ? "Actualizar" : "Crear regla"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RuleEngine() {
  const queryClient = useQueryClient();
  const [dialogRule, setDialogRule] = useState<ORule | null | "new">(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawRules = [], isLoading } = useListOrchestrationRules(
    {}, { query: { queryKey: getListOrchestrationRulesQueryKey({}) } },
  );
  const rules = rawRules as ORule[];
  const activeRules = rules.filter((r) => r.status === "active");

  const { mutate: updateRule } = useUpdateOrchestrationRule({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrchestrationRulesQueryKey({}) }) },
  });
  const { mutate: deleteRule } = useDeleteOrchestrationRule({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrchestrationRulesQueryKey({}) }); setDeleteId(null); } },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Rule Engine</h1>
            <p className="text-sm text-muted-foreground">{activeRules.length} reglas activas · {rules.length} total</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialogRule("new")}>
          <Plus className="h-4 w-4 mr-1.5" />Nueva regla
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Reglas activas", value: activeRules.length, color: "text-green-400" },
          { label: "Inactivas", value: rules.filter((r) => r.status === "inactive").length, color: "text-muted-foreground" },
          { label: "Ejecuciones", value: rules.reduce((s, r) => s + r.executionCount, 0), color: "text-primary" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border/50"><CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </CardContent></Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-20" /></Card>)}</div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
          <GitBranch className="h-10 w-10 opacity-20" />
          <p className="text-sm">No hay reglas configuradas</p>
          <Button variant="outline" size="sm" onClick={() => setDialogRule("new")}><Plus className="h-3.5 w-3.5 mr-1.5" />Crear primera regla</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const actionLines = rule.actions?.split("\n").filter(Boolean) ?? [];
            return (
              <Card key={rule.id} className="border-border/50 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold">{rule.name}</p>
                        <Badge variant="outline" className={`text-[9px] py-0 ${rule.status === "active" ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-muted/15 text-muted-foreground border-muted/30"}`}>
                          {rule.status === "active" ? "Activa" : "Inactiva"}
                        </Badge>
                        {rule.executionCount > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 bg-primary/10 text-primary border-primary/30">
                            <Zap className="h-2.5 w-2.5 mr-0.5" />{rule.executionCount}x ejecutada
                          </Badge>
                        )}
                      </div>
                      {rule.description && <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>}

                      {/* Rule visualization */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-400/10 border border-blue-400/20 text-blue-400">
                          <span className="text-[9px] text-blue-300/60 uppercase tracking-wide">SI</span>
                          <span className="font-medium">{getEventLabel(rule.triggerEvent)}</span>
                        </div>
                        {rule.condition && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <div className="px-2 py-1 rounded-md bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-mono max-w-[200px] truncate">
                              {rule.condition}
                            </div>
                          </>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <div className="flex items-center gap-1 flex-wrap">
                          {actionLines.slice(0, 3).map((a, i) => (
                            <div key={i} className="px-2 py-1 rounded-md bg-green-400/10 border border-green-400/20 text-green-400 text-[10px]">{a}</div>
                          ))}
                          {actionLines.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{actionLines.length - 3} más</span>
                          )}
                          {actionLines.length === 0 && <span className="text-[10px] text-muted-foreground italic">Sin acciones definidas</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Switch
                        checked={rule.status === "active"}
                        onCheckedChange={(checked) => updateRule({ id: rule.id, data: { status: checked ? "active" : "inactive" } })}
                        className="scale-75"
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDialogRule(rule)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(rule.id)}>
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

      {dialogRule && (
        <RuleDialog
          rule={dialogRule === "new" ? undefined : dialogRule}
          open={true}
          onClose={() => setDialogRule(null)}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteRule({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
