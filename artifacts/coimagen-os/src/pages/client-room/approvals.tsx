import { useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListClientApprovals, getListClientApprovalsQueryKey,
  useCreateClientApproval,
  useUpdateClientApproval,
  useDeleteClientApproval,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckSquare, Plus, Clock, CheckCircle2, XCircle, MessageSquare,
  Trash2, ChevronRight,
} from "lucide-react";

const APPROVAL_TYPES = [
  "diseño", "landing", "video", "contenido",
  "logotipo", "material_grafico", "contrato", "otro",
];

type Org = { id: number; slug: string; name: string };
type Approval = {
  id: number; orgId: number; type: string; title: string;
  description?: string | null; status: string; fileUrl?: string | null;
  comments?: string | null; requestedBy?: string | null; createdAt: string;
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  pending:           { label: "Pendiente",        color: "bg-orange-400/15 text-orange-400 border-orange-400/30", icon: Clock },
  approved:          { label: "Aprobado",          color: "bg-green-400/15 text-green-400 border-green-400/30",   icon: CheckCircle2 },
  changes_requested: { label: "Cambios solicitados", color: "bg-red-400/15 text-red-400 border-red-400/30",      icon: XCircle },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: "bg-muted/15 text-muted-foreground border-muted/30", icon: Clock };
}

// ─── Comment/Action Dialog ────────────────────────────────────────────────────
function ActionDialog({ approval, open, action, onClose, onConfirm }: {
  approval: Approval; open: boolean;
  action: "approve" | "changes" | "comment";
  onClose: () => void;
  onConfirm: (comments: string, reviewedBy?: string) => void;
}) {
  const [comments, setComments] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  const titles = {
    approve: "Aprobar documento",
    changes: "Solicitar cambios",
    comment: "Agregar comentario",
  };
  const ctas = { approve: "Aprobar", changes: "Solicitar cambios", comment: "Enviar comentario" };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setComments(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> :
             action === "changes" ? <XCircle className="h-4 w-4 text-red-400" /> :
             <MessageSquare className="h-4 w-4 text-blue-400" />}
            {titles[action]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
            <p className="text-xs text-muted-foreground">Documento</p>
            <p className="text-sm font-medium">{approval.title}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{approval.type}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{action === "comment" ? "Comentario" : "Observaciones"}</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder={
              action === "approve" ? "Aprobado, sin observaciones..." :
              action === "changes" ? "Por favor ajustar..." :
              "Escribir comentario..."
            } />
          </div>
          <div className="space-y-1.5">
            <Label>Tu nombre</Label>
            <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Nombre del revisor" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm"
              className={action === "approve" ? "bg-green-500 hover:bg-green-600 text-white" : action === "changes" ? "bg-red-500 hover:bg-red-600 text-white" : ""}
              onClick={() => { onConfirm(comments, reviewedBy || undefined); setComments(""); setReviewedBy(""); }}
            >
              {ctas[action]}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Dialog ─────────────────────────────────────────────────────────────
function CreateApprovalDialog({ orgId, open, onClose }: { orgId: number; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("diseño");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [requestedBy, setRequestedBy] = useState("");

  const { mutate: create, isPending } = useCreateClientApproval({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientApprovalsQueryKey({}) });
        onClose(); reset();
      },
    },
  });

  function reset() { setType("diseño"); setTitle(""); setDescription(""); setFileUrl(""); setRequestedBy(""); }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva solicitud de aprobación</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Diseño landing page v2" autoFocus /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>URL del archivo</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://drive.google.com/..." /></div>
          <div className="space-y-1.5"><Label>Solicitado por</Label><Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Nombre del equipo" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={() => create({ data: { orgId, type, title, description: description || undefined, fileUrl: fileUrl || undefined, requestedBy: requestedBy || undefined } })} disabled={!title.trim() || isPending}>
              {isPending ? "Creando..." : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ClientApprovals() {
  const [, params] = useRoute("/client/:slug/approvals");
  const slug = params?.slug ?? "";
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{ approval: Approval; type: "approve" | "changes" | "comment" } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: rawApprovals = [], isLoading } = useListClientApprovals(
    {},
    { query: { queryKey: getListClientApprovalsQueryKey({}) } },
  );

  const allApprovals = (rawApprovals as Approval[]).filter((a) => org ? a.orgId === org.id : false);

  const { mutate: updateApproval } = useUpdateClientApproval({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientApprovalsQueryKey({}) });
        setAction(null);
      },
    },
  });

  const { mutate: deleteApproval } = useDeleteClientApproval({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientApprovalsQueryKey({}) });
        setDeleteId(null);
      },
    },
  });

  function handleAction(comments: string, reviewedBy?: string) {
    if (!action) return;
    const status = action.type === "approve" ? "approved" : action.type === "changes" ? "changes_requested" : action.approval.status;
    updateApproval({ id: action.approval.id, data: { status, comments: comments || undefined, reviewedBy } });
  }

  const pending  = allApprovals.filter((a) => a.status === "pending");
  const approved = allApprovals.filter((a) => a.status === "approved");
  const changes  = allApprovals.filter((a) => a.status === "changes_requested");

  const ApprovalCard = ({ a }: { a: Approval }) => {
    const meta = statusMeta(a.status);
    const Icon = meta.icon;
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold">{a.title}</p>
                <Badge variant="outline" className={`text-[10px] py-0 ${meta.color}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{meta.label}</Badge>
                <span className="text-[10px] text-muted-foreground capitalize">{a.type}</span>
              </div>
              {a.description && <p className="text-xs text-muted-foreground mb-2">{a.description}</p>}
              {a.fileUrl && (
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />Ver archivo
                </a>
              )}
              {a.comments && (
                <div className="mt-2 p-2 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground">Comentario:</p>
                  <p className="text-xs">{a.comments}</p>
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(a.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {a.status === "pending" && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white gap-1" onClick={() => setAction({ approval: a, type: "approve" })}>
                <CheckCircle2 className="h-3 w-3" />Aprobar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-400/30 text-red-400 hover:bg-red-400/10" onClick={() => setAction({ approval: a, type: "changes" })}>
                <XCircle className="h-3 w-3" />Cambios
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAction({ approval: a, type: "comment" })}>
                <MessageSquare className="h-3 w-3" />Comentar
              </Button>
            </div>
          )}
          {a.status !== "pending" && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAction({ approval: a, type: "comment" })}>
                <MessageSquare className="h-3 w-3" />Agregar comentario
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Aprobaciones</h1>
              <p className="text-sm text-muted-foreground">Documentos pendientes de revisión</p>
            </div>
          </div>
          {org && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Nueva solicitud
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pendientes", value: pending.length, color: "text-orange-400" },
            { label: "Aprobados", value: approved.length, color: "text-green-400" },
            { label: "Con cambios", value: changes.length, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-border/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="h-8">
            <TabsTrigger value="pending" className="text-xs">Pendientes ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Aprobados ({approved.length})</TabsTrigger>
            <TabsTrigger value="changes" className="text-xs">Con cambios ({changes.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">Todos ({allApprovals.length})</TabsTrigger>
          </TabsList>

          {[
            { value: "pending", items: pending },
            { value: "approved", items: approved },
            { value: "changes", items: changes },
            { value: "all", items: allApprovals },
          ].map(({ value, items }) => (
            <TabsContent key={value} value={value} className="mt-3">
              {isLoading ? (
                <div className="space-y-2">{Array(2).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-20 bg-muted/20" /></Card>)}</div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/50 rounded-xl gap-2 text-muted-foreground">
                  <CheckSquare className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No hay documentos en esta categoría</p>
                </div>
              ) : (
                <div className="space-y-3">{items.map((a) => <ApprovalCard key={a.id} a={a} />)}</div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {org && <CreateApprovalDialog orgId={org.id} open={createOpen} onClose={() => setCreateOpen(false)} />}

      {action && (
        <ActionDialog
          approval={action.approval}
          open={true}
          action={action.type}
          onClose={() => setAction(null)}
          onConfirm={handleAction}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar aprobación?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteApproval({ id: deleteId }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientRoomLayout>
  );
}
