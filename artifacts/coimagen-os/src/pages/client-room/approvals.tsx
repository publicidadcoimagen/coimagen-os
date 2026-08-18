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
import { useAuth } from "@workspace/better-auth-web";
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
import { useLang } from "@/context/LanguageContext";

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

const STATUS_COLOR: Record<string, string> = {
  pending:           "bg-orange-400/15 text-orange-400 border-orange-400/30",
  approved:          "bg-green-400/15 text-green-400 border-green-400/30",
  changes_requested: "bg-red-400/15 text-red-400 border-red-400/30",
};
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock, approved: CheckCircle2, changes_requested: XCircle,
};

// ─── Comment/Action Dialog ────────────────────────────────────────────────────
function ActionDialog({ approval, open, action, onClose, onConfirm }: {
  approval: Approval; open: boolean;
  action: "approve" | "changes" | "comment";
  onClose: () => void;
  onConfirm: (comments: string, reviewedBy?: string) => void;
}) {
  const { t } = useLang();
  const [comments, setComments] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  const titles = {
    approve: t.approvals.dialogApproveTitle,
    changes: t.approvals.dialogChangesTitle,
    comment: t.approvals.dialogCommentTitle,
  };
  const ctas = { approve: t.approvals.ctaApprove, changes: t.approvals.ctaChanges, comment: t.approvals.ctaComment };

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
            <p className="text-xs text-muted-foreground">{t.approvals.document}</p>
            <p className="text-sm font-medium">{approval.title}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{approval.type}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{action === "comment" ? t.approvals.commentField : t.approvals.observations}</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder={
              action === "approve" ? t.approvals.approvedPlaceholder :
              action === "changes" ? t.approvals.changesPlaceholder :
              t.approvals.commentPlaceholder
            } />
          </div>
          <div className="space-y-1.5">
            <Label>{t.approvals.yourName}</Label>
            <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder={t.approvals.reviewerNamePlaceholder} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t.common.cancel}</Button>
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
  const { t } = useLang();
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
        <DialogHeader><DialogTitle>{t.approvals.newRequestTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>{t.approvals.typeLabel}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_TYPES.map((v) => <SelectItem key={v} value={v}>{t.approvals.types[v] ?? v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t.approvals.titleLabel}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.approvals.titlePlaceholder} autoFocus /></div>
          <div className="space-y-1.5"><Label>{t.approvals.descriptionLabel}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>{t.approvals.fileUrlLabel}</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder={t.approvals.fileUrlPlaceholder} /></div>
          <div className="space-y-1.5"><Label>{t.approvals.requestedByLabel}</Label><Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder={t.approvals.requestedByPlaceholder} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>{t.common.cancel}</Button>
            <Button size="sm" onClick={() => create({ data: { orgId, type, title, description: description || undefined, fileUrl: fileUrl || undefined, requestedBy: requestedBy || undefined } })} disabled={!title.trim() || isPending}>
              {isPending ? t.approvals.creating : t.approvals.create}
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
  const { t } = useLang();
  const { user } = useAuth();
  const isCliente = user?.role === "cliente";
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
    const label = t.approvals.status[a.status] ?? a.status;
    const color = STATUS_COLOR[a.status] ?? "bg-muted/15 text-muted-foreground border-muted/30";
    const Icon = STATUS_ICON[a.status] ?? Clock;
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold">{a.title}</p>
                <Badge variant="outline" className={`text-[10px] py-0 ${color}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{label}</Badge>
                <span className="text-[10px] text-muted-foreground capitalize">{a.type}</span>
              </div>
              {a.description && <p className="text-xs text-muted-foreground mb-2">{a.description}</p>}
              {a.fileUrl && (
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />{t.approvals.viewFile}
                </a>
              )}
              {a.comments && (
                <div className="mt-2 p-2 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground">{t.approvals.commentLabel}</p>
                  <p className="text-xs">{a.comments}</p>
                </div>
              )}
            </div>
            {!isCliente && (
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {a.status === "pending" && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white gap-1" onClick={() => setAction({ approval: a, type: "approve" })}>
                <CheckCircle2 className="h-3 w-3" />{t.approvals.btnApprove}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-400/30 text-red-400 hover:bg-red-400/10" onClick={() => setAction({ approval: a, type: "changes" })}>
                <XCircle className="h-3 w-3" />{t.approvals.btnChanges}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAction({ approval: a, type: "comment" })}>
                <MessageSquare className="h-3 w-3" />{t.approvals.btnComment}
              </Button>
            </div>
          )}
          {a.status !== "pending" && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAction({ approval: a, type: "comment" })}>
                <MessageSquare className="h-3 w-3" />{t.approvals.btnAddComment}
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
              <h1 className="text-xl font-bold">{t.approvals.title}</h1>
              <p className="text-sm text-muted-foreground">{t.approvals.subtitle}</p>
            </div>
          </div>
          {org && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />{t.approvals.newRequest}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.approvals.statPending, value: pending.length, color: "text-orange-400" },
            { label: t.approvals.statApproved, value: approved.length, color: "text-green-400" },
            { label: t.approvals.statWithChanges, value: changes.length, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-border/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="h-8">
            <TabsTrigger value="pending" className="text-xs">{t.approvals.statPending} ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">{t.approvals.statApproved} ({approved.length})</TabsTrigger>
            <TabsTrigger value="changes" className="text-xs">{t.approvals.statWithChanges} ({changes.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">{t.approvals.tabAll} ({allApprovals.length})</TabsTrigger>
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
                  <p className="text-sm">{t.approvals.emptyCategory}</p>
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
          <AlertDialogHeader><AlertDialogTitle>{t.approvals.deleteConfirmTitle}</AlertDialogTitle><AlertDialogDescription>{t.approvals.deleteConfirmDesc}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteApproval({ id: deleteId }); }}>{t.approvals.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientRoomLayout>
  );
}
