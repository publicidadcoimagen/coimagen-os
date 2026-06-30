import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListContracts, getListContractsQueryKey,
  useCreateContract, useDeleteContract,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileSignature, Plus, Search, Trash2, FileText, Clock,
  CheckCircle2, XCircle, AlertCircle, Send, Eye, RefreshCw,
  ChevronRight, TrendingUp,
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
  { value: "draft",     label: "Borrador",     color: "bg-slate-400/15 text-slate-400 border-slate-400/30",   icon: FileText },
  { value: "sent",      label: "Enviado",      color: "bg-blue-400/15 text-blue-400 border-blue-400/30",      icon: Send },
  { value: "viewed",    label: "Visto",        color: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",      icon: Eye },
  { value: "signed",    label: "Firmado",      color: "bg-green-400/15 text-green-400 border-green-400/30",   icon: CheckCircle2 },
  { value: "active",    label: "Activo",       color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", icon: CheckCircle2 },
  { value: "expired",   label: "Vencido",      color: "bg-orange-400/15 text-orange-400 border-orange-400/30", icon: AlertCircle },
  { value: "cancelled", label: "Cancelado",    color: "bg-red-400/15 text-red-400 border-red-400/30",         icon: XCircle },
  { value: "rejected",  label: "Rechazado",    color: "bg-rose-400/15 text-rose-400 border-rose-400/30",      icon: XCircle },
];

type Contract = {
  id: number; type: string; status: string; title: string;
  description?: string | null; service?: string | null;
  clientId?: number | null; projectId?: number | null;
  amount?: number | null; currency?: string | null;
  sentAt?: string | null; signedAt?: string | null; expiresAt?: string | null;
  createdBy?: string | null; createdAt: string; updatedAt?: string | null;
};

function statusMeta(s: string) {
  return CONTRACT_STATUSES.find((x) => x.value === s) ?? {
    value: s, label: s, color: "bg-muted/15 text-muted-foreground border-muted/30", icon: FileText,
  };
}

function typeLabel(t: string) {
  return CONTRACT_TYPES.find((x) => x.value === t)?.label ?? t;
}

// ─── Create Dialog ─────────────────────────────────────────────────────────────
function CreateContractDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [type, setType] = useState("desarrollo_web");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MXN");
  const [expiresAt, setExpiresAt] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [createdBy, setCreatedBy] = useState("");

  const { mutate: create, isPending } = useCreateContract({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        navigate(`/contracts/${(data as Contract).id}`);
        onClose();
      },
    },
  });

  const reset = () => {
    setType("desarrollo_web"); setTitle(""); setDescription(""); setService("");
    setAmount(""); setCurrency("MXN"); setExpiresAt(""); setClientId(""); setProjectId(""); setCreatedBy("");
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    create({ data: {
      type, title: title.trim(), description: description || undefined,
      service: service || undefined,
      amount: amount ? Math.round(parseFloat(amount) * 100) : undefined,
      currency,
      expiresAt: expiresAt || undefined,
      clientId: clientId ? parseInt(clientId) : undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      createdBy: createdBy || undefined,
    }});
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />Nuevo Contrato
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Tipo de documento *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Contrato SEO — Clínica Dental ABC" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Servicio contratado</Label>
            <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Ej: SEO Local + Google Business" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Alcance general del contrato..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Monto</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ID Cliente</Label>
              <Input type="number" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ID del cliente" />
            </div>
            <div className="space-y-1.5">
              <Label>ID Proyecto</Label>
              <Input type="number" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="ID del proyecto" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Creado por</Label>
              <Input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Nombre" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!title.trim() || isPending}>
              {isPending ? "Creando..." : "Crear contrato"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contract Row ─────────────────────────────────────────────────────────────
function ContractRow({ contract, onDelete }: { contract: Contract; onDelete: (id: number) => void }) {
  const meta = statusMeta(contract.status);
  const StatusIcon = meta.icon;
  const amountFmt = contract.amount
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: contract.currency ?? "MXN" }).format(contract.amount / 100)
    : null;

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-all group">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileSignature className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link href={`/contracts/${contract.id}`}>
                <span className="text-sm font-semibold hover:text-primary transition-colors">{contract.title}</span>
              </Link>
              <Badge variant="outline" className={`text-[10px] py-0 ${meta.color}`}>
                <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                {meta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground">{typeLabel(contract.type)}</span>
              {contract.service && <span className="text-[10px] text-muted-foreground/60">{contract.service}</span>}
              {amountFmt && <span className="text-[10px] font-medium text-emerald-400">{amountFmt}</span>}
              {contract.signedAt && (
                <span className="text-[10px] text-green-400">Firmado {new Date(contract.signedAt).toLocaleDateString("es-MX")}</span>
              )}
              {contract.expiresAt && !contract.signedAt && (
                <span className="text-[10px] text-orange-400">Vence {new Date(contract.expiresAt).toLocaleDateString("es-MX")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground/40 mr-1">
              {new Date(contract.createdAt).toLocaleDateString("es-MX")}
            </span>
            <Button
              size="sm" variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              onClick={() => onDelete(contract.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/30 hover:text-primary" asChild>
              <Link href={`/contracts/${contract.id}`}><ChevronRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ContractEngine() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const { data: rawContracts = [], isLoading } = useListContracts(
    {},
    { query: { queryKey: getListContractsQueryKey() } },
  );

  const { mutate: deleteContract } = useDeleteContract({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const all = rawContracts as Contract[];

  const filtered = all.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.service?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && c.type !== filterType) return false;
    if (activeTab !== "all" && c.status !== activeTab) return false;
    return true;
  });

  const kpis = {
    total: all.length,
    signed: all.filter((c) => c.status === "signed" || c.status === "active").length,
    pending: all.filter((c) => c.status === "draft" || c.status === "sent" || c.status === "viewed").length,
    expired: all.filter((c) => c.status === "expired").length,
    value: all.filter((c) => c.status === "signed" || c.status === "active").reduce((acc, c) => acc + (c.amount ?? 0), 0),
  };

  const STATUS_TABS = [
    { value: "all", label: "Todos" },
    { value: "draft", label: "Borradores" },
    { value: "sent", label: "Enviados" },
    { value: "signed", label: "Firmados" },
    { value: "active", label: "Activos" },
    { value: "expired", label: "Vencidos" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSignature className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Digital Contract Engine</h1>
            <p className="text-sm text-muted-foreground">Gestión y firma de contratos digitales</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nuevo Contrato
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: kpis.total, icon: FileText, color: "text-muted-foreground" },
          { label: "Firmados / Activos", value: kpis.signed, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pendientes", value: kpis.pending, icon: Clock, color: "text-blue-400" },
          { label: "Vencidos", value: kpis.expired, icon: AlertCircle, color: "text-orange-400" },
          {
            label: "Valor firmado",
            value: kpis.value > 0
              ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(kpis.value / 100)
              : "$0",
            icon: TrendingUp, color: "text-emerald-400",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <div className="flex items-end justify-between">
                <p className={`${typeof value === "string" ? "text-lg" : "text-2xl"} font-bold`}>{value}</p>
                <Icon className={`h-5 w-5 ${color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contratos..." className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {CONTRACT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterType !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setFilterType("all"); }}>
            <RefreshCw className="h-3 w-3 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === "all" ? all.length : all.filter((c) => c.status === tab.value).length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16 bg-muted/20" /></Card>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
                <FileSignature className="h-10 w-10 opacity-20" />
                <p className="text-sm">No hay contratos en esta categoría</p>
                {tab.value === "all" && (
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Crear primer contrato
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <ContractRow key={c.id} contract={c} onDelete={setDeleteId} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateContractDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El contrato será eliminado permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteContract({ id: deleteId }); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
