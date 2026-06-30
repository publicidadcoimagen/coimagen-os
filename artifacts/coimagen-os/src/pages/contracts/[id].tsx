import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetContract, getGetContractQueryKey,
  getListContractsQueryKey,
  useUpdateContract,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSignature, ChevronLeft, ChevronRight, Edit2,
  CheckCircle2, Send, Eye, AlertCircle, XCircle, Clock,
  FileText, User, Calendar, DollarSign, Link2, ScrollText,
} from "lucide-react";

const CONTRACT_TYPES = [
  { value: "desarrollo_web",      label: "Contrato Desarrollo Web" },
  { value: "seo",                 label: "Contrato SEO" },
  { value: "google_business",     label: "Contrato Google Business" },
  { value: "automatizacion_ia",   label: "Contrato Automatización IA" },
  { value: "coimagen_os",         label: "Contrato COIMAGEN OS" },
  { value: "medical_os",          label: "Contrato Medical OS" },
  { value: "mensualidad",         label: "Contrato Mensualidad" },
  { value: "nda",                 label: "NDA" },
  { value: "addendum",            label: "Addendum" },
  { value: "renovacion",          label: "Renovación" },
  { value: "carta_aprobacion_visual", label: "Carta de Aprobación Visual" },
  { value: "carta_entrega_final",     label: "Carta de Entrega Final" },
];

const CONTRACT_STATUSES = [
  { value: "draft",     label: "Borrador",   color: "bg-slate-400/15 text-slate-400 border-slate-400/30",       icon: FileText },
  { value: "sent",      label: "Enviado",    color: "bg-blue-400/15 text-blue-400 border-blue-400/30",          icon: Send },
  { value: "viewed",    label: "Visto",      color: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",          icon: Eye },
  { value: "signed",    label: "Firmado",    color: "bg-green-400/15 text-green-400 border-green-400/30",       icon: CheckCircle2 },
  { value: "active",    label: "Activo",     color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", icon: CheckCircle2 },
  { value: "expired",   label: "Vencido",    color: "bg-orange-400/15 text-orange-400 border-orange-400/30",    icon: AlertCircle },
  { value: "cancelled", label: "Cancelado",  color: "bg-red-400/15 text-red-400 border-red-400/30",             icon: XCircle },
  { value: "rejected",  label: "Rechazado",  color: "bg-rose-400/15 text-rose-400 border-rose-400/30",          icon: XCircle },
];

type Contract = {
  id: number; type: string; status: string; title: string;
  description?: string | null; service?: string | null;
  clientId?: number | null; projectId?: number | null;
  workflowId?: number | null; invoiceId?: number | null; approvalId?: number | null;
  content?: string | null; amount?: number | null; currency?: string | null;
  terms?: string | null; notes?: string | null;
  sentAt?: string | null; signedAt?: string | null; expiresAt?: string | null;
  createdBy?: string | null; signedBy?: string | null;
  createdAt: string; updatedAt?: string | null;
};

function statusMeta(s: string) {
  return CONTRACT_STATUSES.find((x) => x.value === s) ?? {
    value: s, label: s, color: "bg-muted/15 text-muted-foreground border-muted/30", icon: FileText,
  };
}
function typeLabel(t: string) {
  return CONTRACT_TYPES.find((x) => x.value === t)?.label ?? t;
}

// ─── Status Actions Bar ───────────────────────────────────────────────────────
function StatusActions({ contract, onUpdate }: { contract: Contract; onUpdate: (s: string) => void }) {
  const transitions: Record<string, { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
    draft:    [{ to: "sent",      label: "Marcar enviado",   icon: Send },    { to: "cancelled", label: "Cancelar", icon: XCircle }],
    sent:     [{ to: "viewed",    label: "Marcar visto",     icon: Eye },     { to: "signed", label: "Marcar firmado", icon: CheckCircle2 }, { to: "rejected", label: "Rechazado", icon: XCircle }],
    viewed:   [{ to: "signed",    label: "Marcar firmado",   icon: CheckCircle2 }, { to: "rejected", label: "Rechazado", icon: XCircle }],
    signed:   [{ to: "active",    label: "Activar",          icon: CheckCircle2 }, { to: "expired", label: "Marcar vencido", icon: AlertCircle }],
    active:   [{ to: "expired",   label: "Marcar vencido",   icon: AlertCircle }, { to: "cancelled", label: "Cancelar", icon: XCircle }],
    expired:  [{ to: "renewd",    label: "Renovar",          icon: Clock }],
    cancelled:[],
    rejected: [],
  };

  const actions = transitions[contract.status] ?? [];
  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Cambiar estado:</span>
      {actions.map(({ to, label, icon: Icon }) => (
        <Button key={to} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onUpdate(to)}>
          <Icon className="h-3 w-3" />{label}
        </Button>
      ))}
    </div>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
function EditDialog({ contract, open, onClose }: { contract: Contract; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(contract.type);
  const [title, setTitle] = useState(contract.title);
  const [description, setDescription] = useState(contract.description ?? "");
  const [service, setService] = useState(contract.service ?? "");
  const [content, setContent] = useState(contract.content ?? "");
  const [terms, setTerms] = useState(contract.terms ?? "");
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [amount, setAmount] = useState(contract.amount ? String(contract.amount / 100) : "");
  const [currency, setCurrency] = useState(contract.currency ?? "MXN");
  const [clientId, setClientId] = useState(contract.clientId ? String(contract.clientId) : "");
  const [projectId, setProjectId] = useState(contract.projectId ? String(contract.projectId) : "");
  const [workflowId, setWorkflowId] = useState(contract.workflowId ? String(contract.workflowId) : "");
  const [invoiceId, setInvoiceId] = useState(contract.invoiceId ? String(contract.invoiceId) : "");
  const [sentAt, setSentAt] = useState(contract.sentAt ? contract.sentAt.slice(0, 10) : "");
  const [signedAt, setSignedAt] = useState(contract.signedAt ? contract.signedAt.slice(0, 10) : "");
  const [expiresAt, setExpiresAt] = useState(contract.expiresAt ? contract.expiresAt.slice(0, 10) : "");
  const [createdBy, setCreatedBy] = useState(contract.createdBy ?? "");
  const [signedBy, setSignedBy] = useState(contract.signedBy ?? "");

  const { mutate: update, isPending } = useUpdateContract({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contract.id) });
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        onClose();
      },
    },
  });

  const handleSave = () => {
    update({ id: contract.id, data: {
      type, title, description: description || undefined,
      service: service || undefined, content: content || undefined,
      terms: terms || undefined, notes: notes || undefined,
      amount: amount ? Math.round(parseFloat(amount) * 100) : undefined,
      currency,
      clientId: clientId ? parseInt(clientId) : undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      workflowId: workflowId ? parseInt(workflowId) : undefined,
      invoiceId: invoiceId ? parseInt(invoiceId) : undefined,
      sentAt: sentAt || undefined,
      signedAt: signedAt || undefined,
      expiresAt: expiresAt || undefined,
      createdBy: createdBy || undefined,
      signedBy: signedBy || undefined,
    }});
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Contrato #{contract.id}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Servicio contratado</Label><Input value={service} onChange={(e) => setService(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Contenido del contrato</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Cuerpo del contrato, cláusulas, condiciones..." className="font-mono text-xs" /></div>
          <div className="space-y-1.5"><Label>Términos y condiciones</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} /></div>
          <div className="space-y-1.5"><Label>Notas internas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Monto</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Creado por</Label><Input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ID Cliente</Label><Input type="number" value={clientId} onChange={(e) => setClientId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>ID Proyecto</Label><Input type="number" value={projectId} onChange={(e) => setProjectId(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ID Workflow</Label><Input type="number" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>ID Factura</Label><Input type="number" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Fecha envío</Label><Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fecha firma</Label><Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fecha vencimiento</Label><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Firmado por</Label><Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Nombre del firmante" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || isPending}>{isPending ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ContractDetail() {
  const [, params] = useRoute("/contracts/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: rawContract, isLoading } = useGetContract(id, {
    query: { queryKey: getGetContractQueryKey(id), enabled: id > 0 },
  });

  const { mutate: update } = useUpdateContract({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
      },
    },
  });

  const contract = rawContract as Contract | undefined;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground animate-pulse">Cargando contrato...</p>
    </div>
  );
  if (!contract) return (
    <div className="flex flex-col items-center gap-3 min-h-[60vh] justify-center">
      <FileSignature className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Contrato no encontrado</p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/contracts"><ChevronLeft className="h-4 w-4 mr-1" />Volver</Link>
      </Button>
    </div>
  );

  const meta = statusMeta(contract.status);
  const StatusIcon = meta.icon;
  const amountFmt = contract.amount
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: contract.currency ?? "MXN" }).format(contract.amount / 100)
    : null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/contracts" className="hover:text-foreground">Digital Contract Engine</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">#{contract.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono">CTR-{String(contract.id).padStart(4, "0")}</span>
            <Badge variant="outline" className={`text-[10px] py-0 ${meta.color}`}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />{meta.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{typeLabel(contract.type)}</span>
          </div>
          <h1 className="text-xl font-bold">{contract.title}</h1>
          <p className="text-xs text-muted-foreground">
            Creado: {new Date(contract.createdAt).toLocaleString("es-MX")}
            {contract.updatedAt && ` · Actualizado: ${new Date(contract.updatedAt).toLocaleString("es-MX")}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar
        </Button>
      </div>

      {/* Status actions */}
      <StatusActions contract={contract} onUpdate={(s) => update({ id: contract.id, data: { status: s } })} />

      {/* Body */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="col-span-1 space-y-3">
          <Card className="border-border/50">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Información</p>
              {[
                { icon: FileText,   label: "Tipo",       value: typeLabel(contract.type) },
                { icon: DollarSign, label: "Monto",      value: amountFmt ?? "—" },
                { icon: User,       label: "Creado por", value: contract.createdBy ?? "—" },
                { icon: User,       label: "Firmado por",value: contract.signedBy ?? "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-xs">{value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Fechas clave</p>
              {[
                { icon: Calendar, label: "Creación",    value: new Date(contract.createdAt).toLocaleDateString("es-MX") },
                { icon: Send,     label: "Envío",       value: contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("es-MX") : "—" },
                { icon: CheckCircle2, label: "Firma",   value: contract.signedAt ? new Date(contract.signedAt).toLocaleDateString("es-MX") : "—" },
                { icon: Clock,    label: "Vencimiento", value: contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString("es-MX") : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-xs">{value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {(contract.clientId || contract.projectId || contract.workflowId || contract.invoiceId) && (
            <Card className="border-border/50">
              <CardContent className="p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Vínculos</p>
                {[
                  { label: "Cliente", value: contract.clientId, href: `/clients/${contract.clientId}` },
                  { label: "Proyecto", value: contract.projectId, href: `/projects/${contract.projectId}` },
                  { label: "Workflow", value: contract.workflowId, href: `/workflow-engine/${contract.workflowId}` },
                  { label: "Factura", value: contract.invoiceId, href: `/finance/invoices` },
                ].filter((l) => l.value).map(({ label, value, href }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                    <Link href={href} className="text-xs text-primary hover:underline">{label} #{value}</Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Content tabs */}
        <div className="col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="h-8">
              <TabsTrigger value="details" className="text-xs gap-1"><FileText className="h-3 w-3" />Detalles</TabsTrigger>
              <TabsTrigger value="content" className="text-xs gap-1"><ScrollText className="h-3 w-3" />Contenido</TabsTrigger>
              {(contract.terms || contract.notes) && (
                <TabsTrigger value="terms" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Términos y notas</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="mt-3 space-y-3">
              {contract.service && (
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Servicio contratado</p>
                  <p className="text-sm">{contract.service}</p>
                </div>
              )}
              {contract.description ? (
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm whitespace-pre-wrap">{contract.description}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground py-4 text-center">Sin descripción registrada</p>}
            </TabsContent>

            <TabsContent value="content" className="mt-3">
              {contract.content ? (
                <div className="p-4 rounded-lg border border-border/40 bg-muted/5">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{contract.content}</pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
                  <ScrollText className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Sin contenido registrado</p>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" />Agregar contenido
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="terms" className="mt-3 space-y-3">
              {contract.terms && (
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Términos y condiciones</p>
                  <p className="text-sm whitespace-pre-wrap">{contract.terms}</p>
                </div>
              )}
              {contract.notes && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-xs font-semibold text-primary mb-1">Notas internas</p>
                  <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {contract && <EditDialog contract={contract} open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
