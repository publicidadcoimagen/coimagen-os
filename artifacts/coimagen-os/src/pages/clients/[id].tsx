import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetClient,
  useListProjects,
  useListClientAccess,
  useCreateClientAccess,
  useUpdateClientAccess,
  useDeleteClientAccess,
  useGetClientBrand,
  useUpsertClientBrand,
  useGetClientOnboarding,
  useUpsertClientOnboarding,
  useListClientTimeline,
  useCreateClientTimeline,
  useDeleteClientTimeline,
  useListClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
  getGetClientQueryKey,
  getListProjectsQueryKey,
  getListClientAccessQueryKey,
  getGetClientBrandQueryKey,
  getGetClientOnboardingQueryKey,
  getListClientTimelineQueryKey,
  getListClientNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  Building2, Mail, Phone, Calendar, Briefcase, Plus, Key, Eye, EyeOff,
  Pencil, Trash2, Globe, Shield, CheckCircle2, XCircle, Lock, ExternalLink,
  Palette, Image, Link2, AlignLeft, Layers, Clock, StickyNote, Pin,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const ACCESS_TYPES = [
  "social_media", "google_business", "website", "domain", "hosting",
  "email", "whatsapp", "youtube", "facebook_business", "instagram",
  "google_analytics", "google_search_console", "payment_platform", "crm", "other",
];
const ACCESS_TYPE_LABELS: Record<string, string> = {
  social_media: "Social Media", google_business: "Google Business", website: "Sitio Web",
  domain: "Dominio", hosting: "Hosting", email: "Email", whatsapp: "WhatsApp",
  youtube: "YouTube", facebook_business: "Facebook Business Manager", instagram: "Instagram",
  google_analytics: "Google Analytics", google_search_console: "Google Search Console",
  payment_platform: "Plataforma de Pagos", crm: "CRM", other: "Otro",
};
const PERMISSION_STATUSES = ["not_requested", "requested", "received", "verified", "needs_update", "revoked"];
const PERMISSION_LABELS: Record<string, string> = {
  not_requested: "No solicitado", requested: "Solicitado", received: "Recibido",
  verified: "Verificado", needs_update: "Necesita actualización", revoked: "Revocado",
};
const PERMISSION_COLORS: Record<string, string> = {
  not_requested: "bg-zinc-700 text-zinc-300", requested: "bg-blue-900 text-blue-300",
  received: "bg-yellow-900 text-yellow-300", verified: "bg-green-900 text-green-300",
  needs_update: "bg-orange-900 text-orange-300", revoked: "bg-red-900 text-red-300",
};
const ACCESS_STATUSES = ["active", "pending", "expired", "invalid", "suspended"];
const ACCESS_STATUS_LABELS: Record<string, string> = {
  active: "Activo", pending: "Pendiente", expired: "Expirado", invalid: "Inválido", suspended: "Suspendido",
};
const ACCESS_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900 text-green-300", pending: "bg-yellow-900 text-yellow-300",
  expired: "bg-zinc-700 text-zinc-300", invalid: "bg-red-900 text-red-300",
  suspended: "bg-orange-900 text-orange-300",
};
const ONBOARDING_ITEMS = [
  { key: "hasLogo", label: "Logo" },
  { key: "hasWebsiteAccess", label: "Acceso a sitio web" },
  { key: "hasDomainAccess", label: "Acceso al dominio" },
  { key: "hasHostingAccess", label: "Acceso al hosting" },
  { key: "hasFacebookAccess", label: "Acceso a Facebook" },
  { key: "hasInstagramAccess", label: "Acceso a Instagram" },
  { key: "hasGoogleBusinessAccess", label: "Acceso a Google Business" },
  { key: "hasWhatsappAccess", label: "Acceso a WhatsApp Business" },
  { key: "hasBrandColors", label: "Colores de marca" },
  { key: "hasBusinessInfo", label: "Información del negocio" },
] as const;
type OnboardingKey = (typeof ONBOARDING_ITEMS)[number]["key"];

const TIMELINE_EVENT_TYPES: Record<string, string> = {
  note: "Nota", proposal_sent: "Propuesta enviada", payment_received: "Pago recibido",
  project_started: "Proyecto iniciado", project_delivered: "Entrega", meeting: "Reunión",
  onboarding_step: "Onboarding", report_sent: "Reporte enviado", contract_signed: "Contrato firmado",
  call: "Llamada", other: "Otro",
};

const NOTE_CATEGORIES: Record<string, string> = {
  general: "General", strategic: "Estrategia", billing: "Facturación",
  feedback: "Feedback", internal: "Interno", urgent: "Urgente",
};

const emptyAccess = {
  accessType: "website", platform: "", accountName: "", loginUrl: "",
  usernameEmail: "", passwordPlaceholder: "", apiKeyPlaceholder: "",
  tokenPlaceholder: "", permissionStatus: "not_requested", accessStatus: "pending", notes: "",
};

function MaskedField({ value }: { value: string | null | undefined }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs text-muted-foreground">
        {show ? value : "••••••••"}
      </span>
      <button onClick={() => setShow((s) => !s)} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { toast } = useToast();

  /* ── Data hooks ── */
  const { data: client, isLoading: isLoadingClient } = useGetClient(id, {
    query: { queryKey: getGetClientQueryKey(id) },
  });
  const { data: projects, isLoading: isLoadingProjects } = useListProjects(
    { clientId: id },
    { query: { queryKey: getListProjectsQueryKey({ clientId: id }) } }
  );
  const { data: accessList, isLoading: isLoadingAccess } = useListClientAccess(id, {
    query: { queryKey: getListClientAccessQueryKey(id) },
  });
  const { data: brand } = useGetClientBrand(id, {
    query: { queryKey: getGetClientBrandQueryKey(id), retry: false },
  });
  const { data: onboarding } = useGetClientOnboarding(id, {
    query: { queryKey: getGetClientOnboardingQueryKey(id), retry: false },
  });
  const { data: timeline } = useListClientTimeline(id, {
    query: { queryKey: getListClientTimelineQueryKey(id), retry: false },
  });
  const { data: notes } = useListClientNotes(id, {
    query: { queryKey: getListClientNotesQueryKey(id), retry: false },
  });

  /* ── Mutations ── */
  const createAccess = useCreateClientAccess();
  const updateAccess = useUpdateClientAccess();
  const deleteAccess = useDeleteClientAccess();
  const upsertBrand = useUpsertClientBrand();
  const upsertOnboarding = useUpsertClientOnboarding();
  const createTimeline = useCreateClientTimeline();
  const deleteTimeline = useDeleteClientTimeline();
  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  /* ── Access state ── */
  const [accessModal, setAccessModal] = useState(false);
  const [editingAccess, setEditingAccess] = useState<(typeof emptyAccess & { id?: number }) | null>(null);
  const [accessForm, setAccessForm] = useState({ ...emptyAccess });

  /* ── Brand state ── */
  const [brandForm, setBrandForm] = useState({
    logoUrl: "", brandColors: "", fonts: "", brandNotes: "",
    websiteUrl: "", facebookUrl: "", instagramUrl: "", googleBusinessUrl: "", youtubeUrl: "",
  });
  const [brandEditing, setBrandEditing] = useState(false);

  /* ── Onboarding state ── */
  const [onboardingState, setOnboardingState] = useState<Record<OnboardingKey, boolean>>({
    hasLogo: false, hasWebsiteAccess: false, hasDomainAccess: false, hasHostingAccess: false,
    hasFacebookAccess: false, hasInstagramAccess: false, hasGoogleBusinessAccess: false,
    hasWhatsappAccess: false, hasBrandColors: false, hasBusinessInfo: false,
  });
  const [onboardingNotes, setOnboardingNotes] = useState("");
  const [onboardingEditing, setOnboardingEditing] = useState(false);

  /* ── Timeline state ── */
  const [timelineModal, setTimelineModal] = useState(false);
  const [timelineForm, setTimelineForm] = useState({ title: "", eventType: "note", description: "", occurredAt: "" });

  /* ── Notes state ── */
  const [noteModal, setNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: number; title: string; category: string; content: string; pinned: boolean } | null>(null);
  const [noteForm, setNoteForm] = useState({ title: "", category: "general", content: "", pinned: false });

  /* ── Invalidation helpers ── */
  const invalidateAccess = () => qc.invalidateQueries({ queryKey: getListClientAccessQueryKey(id) });
  const invalidateBrand = () => qc.invalidateQueries({ queryKey: getGetClientBrandQueryKey(id) });
  const invalidateOnboarding = () => qc.invalidateQueries({ queryKey: getGetClientOnboardingQueryKey(id) });
  const invalidateTimeline = () => qc.invalidateQueries({ queryKey: getListClientTimelineQueryKey(id) });
  const invalidateNotes = () => qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(id) });

  /* ── Access handlers ── */
  const openCreateAccess = () => { setEditingAccess(null); setAccessForm({ ...emptyAccess }); setAccessModal(true); };
  const openEditAccess = (row: NonNullable<typeof accessList>[number]) => {
    setEditingAccess({ id: row.id, ...emptyAccess });
    setAccessForm({
      accessType: row.accessType ?? "other", platform: row.platform ?? "",
      accountName: row.accountName ?? "", loginUrl: row.loginUrl ?? "",
      usernameEmail: row.usernameEmail ?? "", passwordPlaceholder: row.passwordPlaceholder ?? "",
      apiKeyPlaceholder: row.apiKeyPlaceholder ?? "", tokenPlaceholder: row.tokenPlaceholder ?? "",
      permissionStatus: row.permissionStatus ?? "not_requested", accessStatus: row.accessStatus ?? "pending",
      notes: row.notes ?? "",
    });
    setAccessModal(true);
  };
  const saveAccess = () => {
    const payload = { ...accessForm, clientId: id, passwordPlaceholder: accessForm.passwordPlaceholder || undefined, apiKeyPlaceholder: accessForm.apiKeyPlaceholder || undefined, tokenPlaceholder: accessForm.tokenPlaceholder || undefined };
    if (editingAccess?.id) {
      updateAccess.mutate({ clientId: id, id: editingAccess.id, data: payload } as Parameters<typeof updateAccess.mutate>[0], { onSuccess: () => { invalidateAccess(); setAccessModal(false); } });
    } else {
      createAccess.mutate({ clientId: id, data: payload } as Parameters<typeof createAccess.mutate>[0], { onSuccess: () => { invalidateAccess(); setAccessModal(false); } });
    }
  };
  const handleDeleteAccess = (accessId: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    deleteAccess.mutate({ clientId: id, id: accessId } as Parameters<typeof deleteAccess.mutate>[0], { onSuccess: invalidateAccess });
  };

  /* ── Brand handlers ── */
  const startEditBrand = () => { setBrandForm({ logoUrl: brand?.logoUrl ?? "", brandColors: brand?.brandColors ?? "", fonts: brand?.fonts ?? "", brandNotes: brand?.brandNotes ?? "", websiteUrl: brand?.websiteUrl ?? "", facebookUrl: brand?.facebookUrl ?? "", instagramUrl: brand?.instagramUrl ?? "", googleBusinessUrl: brand?.googleBusinessUrl ?? "", youtubeUrl: brand?.youtubeUrl ?? "" }); setBrandEditing(true); };
  const saveBrand = () => { upsertBrand.mutate({ clientId: id, data: brandForm } as Parameters<typeof upsertBrand.mutate>[0], { onSuccess: () => { invalidateBrand(); setBrandEditing(false); } }); };

  /* ── Onboarding handlers ── */
  const startEditOnboarding = () => { setOnboardingState({ hasLogo: onboarding?.hasLogo ?? false, hasWebsiteAccess: onboarding?.hasWebsiteAccess ?? false, hasDomainAccess: onboarding?.hasDomainAccess ?? false, hasHostingAccess: onboarding?.hasHostingAccess ?? false, hasFacebookAccess: onboarding?.hasFacebookAccess ?? false, hasInstagramAccess: onboarding?.hasInstagramAccess ?? false, hasGoogleBusinessAccess: onboarding?.hasGoogleBusinessAccess ?? false, hasWhatsappAccess: onboarding?.hasWhatsappAccess ?? false, hasBrandColors: onboarding?.hasBrandColors ?? false, hasBusinessInfo: onboarding?.hasBusinessInfo ?? false }); setOnboardingNotes(onboarding?.notes ?? ""); setOnboardingEditing(true); };
  const saveOnboarding = () => { upsertOnboarding.mutate({ clientId: id, data: { ...onboardingState, notes: onboardingNotes } } as Parameters<typeof upsertOnboarding.mutate>[0], { onSuccess: () => { invalidateOnboarding(); setOnboardingEditing(false); } }); };

  /* ── Timeline handlers ── */
  const handleSaveTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    createTimeline.mutate(
      { clientId: id, data: { title: timelineForm.title, eventType: timelineForm.eventType, description: timelineForm.description || undefined, occurredAt: timelineForm.occurredAt || undefined } } as Parameters<typeof createTimeline.mutate>[0],
      { onSuccess: () => { invalidateTimeline(); setTimelineModal(false); setTimelineForm({ title: "", eventType: "note", description: "", occurredAt: "" }); toast({ title: "Evento añadido" }); } }
    );
  };
  const handleDeleteTimeline = (eventId: number) => {
    if (!confirm("¿Eliminar este evento?")) return;
    deleteTimeline.mutate({ clientId: id, id: eventId } as Parameters<typeof deleteTimeline.mutate>[0], { onSuccess: invalidateTimeline });
  };

  /* ── Notes handlers ── */
  const openCreateNote = () => { setEditingNote(null); setNoteForm({ title: "", category: "general", content: "", pinned: false }); setNoteModal(true); };
  const openEditNote = (n: NonNullable<typeof notes>[number]) => { setEditingNote({ id: n.id, title: n.title, category: n.category, content: n.content ?? "", pinned: n.pinned }); setNoteForm({ title: n.title, category: n.category, content: n.content ?? "", pinned: n.pinned }); setNoteModal(true); };
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNote) {
      updateNote.mutate({ clientId: id, id: editingNote.id, data: noteForm } as Parameters<typeof updateNote.mutate>[0], { onSuccess: () => { invalidateNotes(); setNoteModal(false); toast({ title: "Nota actualizada" }); } });
    } else {
      createNote.mutate({ clientId: id, data: noteForm } as Parameters<typeof createNote.mutate>[0], { onSuccess: () => { invalidateNotes(); setNoteModal(false); toast({ title: "Nota creada" }); } });
    }
  };
  const handleDeleteNote = (noteId: number) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    deleteNote.mutate({ clientId: id, id: noteId } as Parameters<typeof deleteNote.mutate>[0], { onSuccess: invalidateNotes });
  };

  if (isLoadingClient) return <div className="p-8 text-muted-foreground">Cargando cliente...</div>;
  if (!client) return <div className="p-8 text-muted-foreground">Cliente no encontrado.</div>;

  const onboardingProgress = onboarding ? ONBOARDING_ITEMS.filter((i) => onboarding[i.key]).length : 0;
  const onboardingTotal = ONBOARDING_ITEMS.length;
  const onboardingPct = Math.round((onboardingProgress / onboardingTotal) * 100);
  const activeProjects = projects?.filter(p => p.status === "active") ?? [];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Building2 className="h-4 w-4" />
            {client.company || "Sin empresa registrada"}
          </p>
        </div>
        <StatusBadge status={client.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{client.email || "—"}</div>
        <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{client.phone || "—"}</div>
        <div className="flex items-center gap-2"><Briefcase className="h-4 w-4" />{client.industry || "—"}</div>
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Alta {formatDate(client.createdAt)}</div>
      </div>

      {/* ── CLIENT HOME ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3 font-semibold">Resumen del cliente</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Proyectos activos</p>
            <p className="text-2xl font-bold text-primary">{activeProjects.length}</p>
            <p className="text-xs text-muted-foreground">{projects?.length ?? 0} total</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Onboarding</p>
            <p className="text-2xl font-bold">{onboardingPct}%</p>
            <Progress value={onboardingPct} className="h-1.5 mt-2" />
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Accesos registrados</p>
            <p className="text-2xl font-bold text-secondary">{accessList?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">en bóveda</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Historial</p>
            <p className="text-2xl font-bold text-accent">{timeline?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">eventos registrados</p>
          </Card>
        </div>
      </div>

      {/* ── TABS ── */}
      <Tabs defaultValue="projects">
        <TabsList className="h-10 flex-wrap">
          <TabsTrigger value="projects" className="gap-1.5"><Layers className="h-4 w-4" />Proyectos</TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5"><Key className="h-4 w-4" />Bóveda de Accesos</TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5"><Palette className="h-4 w-4" />Marca</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5"><CheckCircle2 className="h-4 w-4" />Onboarding</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Clock className="h-4 w-4" />Historial</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="h-4 w-4" />Notas</TabsTrigger>
        </TabsList>

        {/* ── PROYECTOS ── */}
        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Proyectos asociados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Vencimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingProjects ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : !projects || projects.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin proyectos.</TableCell></TableRow>
                  ) : projects.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link href={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                      </TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell><PriorityBadge priority={p.priority || "medium"} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {client.notes && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-lg">Notas del cliente</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── BÓVEDA DE ACCESOS ── */}
        <TabsContent value="access" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Bóveda de Accesos</h2>
              <p className="text-sm text-muted-foreground">Placeholders de credenciales por plataforma. No se almacenan claves reales.</p>
            </div>
            <Button size="sm" onClick={openCreateAccess}><Plus className="h-4 w-4 mr-2" />Registrar acceso</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plataforma / Cuenta</TableHead>
                    <TableHead>Usuario / Email</TableHead>
                    <TableHead>Contraseña</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Permiso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAccess ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : !accessList || accessList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        <Lock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Sin registros. Haz clic en "Registrar acceso" para comenzar.
                      </TableCell>
                    </TableRow>
                  ) : accessList.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell><span className="text-xs font-medium">{ACCESS_TYPE_LABELS[row.accessType] ?? row.accessType}</span></TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.platform || "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.accountName || ""}</div>
                        {row.loginUrl && (
                          <a href={row.loginUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                            <ExternalLink className="h-3 w-3" />URL
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.usernameEmail || "—"}</TableCell>
                      <TableCell><MaskedField value={row.passwordPlaceholder} /></TableCell>
                      <TableCell><MaskedField value={row.apiKeyPlaceholder} /></TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERMISSION_COLORS[row.permissionStatus] ?? ""}`}>
                          {PERMISSION_LABELS[row.permissionStatus] ?? row.permissionStatus}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_STATUS_COLORS[row.accessStatus] ?? ""}`}>
                          {ACCESS_STATUS_LABELS[row.accessStatus] ?? row.accessStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAccess(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAccess(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="border border-dashed border-zinc-700 bg-zinc-900/30">
            <CardContent className="py-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-cyan-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Portal de Onboarding para Clientes — Próximamente</p>
                <p className="text-xs text-muted-foreground">En el futuro, los clientes podrán ingresar sus propios accesos de forma segura.</p>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0 text-xs">Próximamente</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MARCA ── */}
        <TabsContent value="brand" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><Image className="h-5 w-5" />Activos de Marca</CardTitle>
                <CardDescription>Logo, colores, tipografía y URLs de presencia digital.</CardDescription>
              </div>
              {!brandEditing && (
                <Button size="sm" variant="outline" onClick={startEditBrand}>
                  <Pencil className="h-4 w-4 mr-2" />{brand ? "Editar" : "Configurar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {brandEditing ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>URL del Logo</Label><Input placeholder="https://..." value={brandForm.logoUrl} onChange={(e) => setBrandForm((f) => ({ ...f, logoUrl: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Colores (HEX, separados por coma)</Label><Input placeholder="#7c3aed, #0891b2" value={brandForm.brandColors} onChange={(e) => setBrandForm((f) => ({ ...f, brandColors: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Tipografías</Label><Input placeholder="Inter, Playfair Display" value={brandForm.fonts} onChange={(e) => setBrandForm((f) => ({ ...f, fonts: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Sitio Web</Label><Input placeholder="https://cliente.com" value={brandForm.websiteUrl} onChange={(e) => setBrandForm((f) => ({ ...f, websiteUrl: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Facebook</Label><Input placeholder="https://facebook.com/..." value={brandForm.facebookUrl} onChange={(e) => setBrandForm((f) => ({ ...f, facebookUrl: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Instagram</Label><Input placeholder="https://instagram.com/..." value={brandForm.instagramUrl} onChange={(e) => setBrandForm((f) => ({ ...f, instagramUrl: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Google Business</Label><Input placeholder="https://business.google.com/..." value={brandForm.googleBusinessUrl} onChange={(e) => setBrandForm((f) => ({ ...f, googleBusinessUrl: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>YouTube</Label><Input placeholder="https://youtube.com/..." value={brandForm.youtubeUrl} onChange={(e) => setBrandForm((f) => ({ ...f, youtubeUrl: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Notas de marca</Label><Textarea placeholder="Guía de estilo, tono de voz..." rows={3} value={brandForm.brandNotes} onChange={(e) => setBrandForm((f) => ({ ...f, brandNotes: e.target.value }))} /></div>
                  <div className="flex gap-2">
                    <Button onClick={saveBrand} disabled={upsertBrand.isPending}>Guardar</Button>
                    <Button variant="outline" onClick={() => setBrandEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : !brand ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Palette className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin activos de marca configurados.</p>
                  <Button size="sm" className="mt-3" onClick={startEditBrand}><Plus className="h-4 w-4 mr-2" />Configurar marca</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {brand.logoUrl && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Logo</p>
                      <img src={brand.logoUrl} alt="Logo" className="h-16 object-contain rounded border border-zinc-700 p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  {brand.brandColors && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Colores</p>
                      <div className="flex gap-2 flex-wrap">
                        {brand.brandColors.split(",").map((c) => c.trim()).filter(Boolean).map((color) => (
                          <div key={color} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full border border-zinc-700" style={{ backgroundColor: color }} />
                            <span className="text-xs font-mono">{color}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {brand.fonts && <div className="space-y-1"><p className="text-xs text-muted-foreground uppercase tracking-wide">Tipografías</p><p className="text-sm">{brand.fonts}</p></div>}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "Sitio Web", value: brand.websiteUrl, icon: Globe },
                      { label: "Facebook", value: brand.facebookUrl, icon: Link2 },
                      { label: "Instagram", value: brand.instagramUrl, icon: Link2 },
                      { label: "Google Business", value: brand.googleBusinessUrl, icon: Link2 },
                      { label: "YouTube", value: brand.youtubeUrl, icon: Link2 },
                    ].map(({ label, value, icon: Icon }) => value ? (
                      <a key={label} href={value} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline truncate">
                        <Icon className="h-4 w-4 shrink-0" />{label}
                      </a>
                    ) : null)}
                  </div>
                  {brand.brandNotes && <div className="space-y-1"><p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><AlignLeft className="h-3 w-3" />Notas</p><p className="text-sm whitespace-pre-wrap text-muted-foreground">{brand.brandNotes}</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ONBOARDING ── */}
        <TabsContent value="onboarding" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Checklist de Onboarding</CardTitle>
                <CardDescription>Información y accesos recibidos del cliente.</CardDescription>
              </div>
              {!onboardingEditing && (
                <Button size="sm" variant="outline" onClick={startEditOnboarding}>
                  <Pencil className="h-4 w-4 mr-2" />{onboarding ? "Editar" : "Iniciar"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {onboarding && !onboardingEditing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className="font-semibold">{onboardingProgress}/{onboardingTotal} ({onboardingPct}%)</span>
                  </div>
                  <Progress value={onboardingPct} className="h-2" />
                </div>
              )}
              {onboardingEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ONBOARDING_ITEMS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                        <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                        <Switch id={key} checked={onboardingState[key]} onCheckedChange={(v) => setOnboardingState((s) => ({ ...s, [key]: v }))} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5"><Label>Notas</Label><Textarea placeholder="Observaciones..." rows={3} value={onboardingNotes} onChange={(e) => setOnboardingNotes(e.target.value)} /></div>
                  <div className="flex gap-2">
                    <Button onClick={saveOnboarding} disabled={upsertOnboarding.isPending}>Guardar</Button>
                    <Button variant="outline" onClick={() => setOnboardingEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : !onboarding ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Onboarding no iniciado.</p>
                  <Button size="sm" className="mt-3" onClick={startEditOnboarding}><Plus className="h-4 w-4 mr-2" />Iniciar onboarding</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ONBOARDING_ITEMS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                        {onboarding[key] ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-zinc-600 shrink-0" />}
                        <span className={`text-sm ${onboarding[key] ? "" : "text-muted-foreground"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {onboarding.notes && <div className="space-y-1 pt-2"><p className="text-xs text-muted-foreground uppercase tracking-wide">Notas</p><p className="text-sm whitespace-pre-wrap text-muted-foreground">{onboarding.notes}</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border border-dashed border-zinc-700 bg-zinc-900/30">
            <CardContent className="py-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-cyan-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Portal de Onboarding para Clientes — Próximamente</p>
                <p className="text-xs text-muted-foreground">Los clientes podrán completar su onboarding desde un portal dedicado.</p>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0 text-xs">Próximamente</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORIAL (TIMELINE) ── */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Historial del Cliente</h2>
              <p className="text-sm text-muted-foreground">Registro cronológico de eventos importantes.</p>
            </div>
            <Button size="sm" onClick={() => setTimelineModal(true)}><Plus className="h-4 w-4 mr-2" />Añadir evento</Button>
          </div>
          {!timeline || timeline.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Sin eventos registrados.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setTimelineModal(true)}><Plus className="h-4 w-4 mr-2" />Añadir primer evento</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative border-l border-zinc-700 ml-4 space-y-0">
              {timeline.map((event) => (
                <div key={event.id} className="relative pl-6 pb-6 group">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {TIMELINE_EVENT_TYPES[event.eventType] ?? event.eventType}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</span>
                      </div>
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{event.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0" onClick={() => handleDeleteTimeline(event.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── NOTAS ── */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Notas del Cliente</h2>
              <p className="text-sm text-muted-foreground">Notas internas por categoría. Las fijadas aparecen primero.</p>
            </div>
            <Button size="sm" onClick={openCreateNote}><Plus className="h-4 w-4 mr-2" />Nueva nota</Button>
          </div>
          {!notes || notes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Sin notas registradas.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={openCreateNote}><Plus className="h-4 w-4 mr-2" />Crear primera nota</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => (
                <Card key={note.id} className={note.pinned ? "border-primary/30 bg-primary/5" : ""}>
                  <CardHeader className="flex flex-row items-start justify-between pb-2 pt-4 px-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {note.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="text-sm font-semibold truncate">{note.title}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditNote(note)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteNote(note.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground mb-2 inline-block">
                      {NOTE_CATEGORIES[note.category] ?? note.category}
                    </span>
                    {note.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{note.content}</p>}
                    <p className="text-[10px] text-muted-foreground/50 mt-2">{formatDate(note.updatedAt ?? note.createdAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── ACCESS MODAL ── */}
      <Dialog open={accessModal} onOpenChange={setAccessModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingAccess?.id ? "Editar acceso" : "Registrar acceso"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de acceso</Label>
                <Select value={accessForm.accessType} onValueChange={(v) => setAccessForm((f) => ({ ...f, accessType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCESS_TYPES.map((t) => (<SelectItem key={t} value={t}>{ACCESS_TYPE_LABELS[t]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Plataforma</Label><Input placeholder="ej. Meta Business Suite" value={accessForm.platform} onChange={(e) => setAccessForm((f) => ({ ...f, platform: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Nombre de cuenta</Label><Input placeholder="ej. Coimagen - Cliente X" value={accessForm.accountName} onChange={(e) => setAccessForm((f) => ({ ...f, accountName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>URL de login</Label><Input placeholder="https://..." value={accessForm.loginUrl} onChange={(e) => setAccessForm((f) => ({ ...f, loginUrl: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Usuario / Email</Label><Input placeholder="usuario@email.com" value={accessForm.usernameEmail} onChange={(e) => setAccessForm((f) => ({ ...f, usernameEmail: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Placeholder contraseña</Label><Input placeholder="${CLIENT_WEB_PASS}" value={accessForm.passwordPlaceholder} onChange={(e) => setAccessForm((f) => ({ ...f, passwordPlaceholder: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="flex items-center gap-1"><Key className="h-3 w-3" />Placeholder API Key</Label><Input placeholder="${CLIENT_API_KEY}" value={accessForm.apiKeyPlaceholder} onChange={(e) => setAccessForm((f) => ({ ...f, apiKeyPlaceholder: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="flex items-center gap-1"><Key className="h-3 w-3" />Placeholder Token</Label><Input placeholder="${CLIENT_ACCESS_TOKEN}" value={accessForm.tokenPlaceholder} onChange={(e) => setAccessForm((f) => ({ ...f, tokenPlaceholder: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Estado de permisos</Label>
                <Select value={accessForm.permissionStatus} onValueChange={(v) => setAccessForm((f) => ({ ...f, permissionStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERMISSION_STATUSES.map((s) => (<SelectItem key={s} value={s}>{PERMISSION_LABELS[s]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado de acceso</Label>
                <Select value={accessForm.accessStatus} onValueChange={(v) => setAccessForm((f) => ({ ...f, accessStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCESS_STATUSES.map((s) => (<SelectItem key={s} value={s}>{ACCESS_STATUS_LABELS[s]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea placeholder="Observaciones adicionales..." rows={2} value={accessForm.notes} onChange={(e) => setAccessForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessModal(false)}>Cancelar</Button>
            <Button onClick={saveAccess} disabled={updateAccess.isPending || createAccess.isPending}>
              {updateAccess.isPending || createAccess.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TIMELINE MODAL ── */}
      <Dialog open={timelineModal} onOpenChange={setTimelineModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Añadir evento al historial</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTimeline} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de evento</Label>
              <Select value={timelineForm.eventType} onValueChange={(v) => setTimelineForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIMELINE_EVENT_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={timelineForm.title} onChange={e => setTimelineForm(f => ({ ...f, title: e.target.value }))} placeholder="Descripción breve del evento" required />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={timelineForm.description} onChange={e => setTimelineForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles adicionales..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha del evento</Label>
              <Input type="date" value={timelineForm.occurredAt} onChange={e => setTimelineForm(f => ({ ...f, occurredAt: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setTimelineModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={createTimeline.isPending}>{createTimeline.isPending ? "Guardando..." : "Añadir evento"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── NOTE MODAL ── */}
      <Dialog open={noteModal} onOpenChange={setNoteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingNote ? "Editar nota" : "Nueva nota"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveNote} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} placeholder="Título de la nota" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={noteForm.category} onValueChange={v => setNoteForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(NOTE_CATEGORIES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch id="pinned" checked={noteForm.pinned} onCheckedChange={v => setNoteForm(f => ({ ...f, pinned: v }))} />
                  <Label htmlFor="pinned" className="cursor-pointer flex items-center gap-1"><Pin className="h-3.5 w-3.5" />Fijar nota</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Textarea value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} placeholder="Escribe el contenido de la nota..." rows={4} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setNoteModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={createNote.isPending || updateNote.isPending}>
                {createNote.isPending || updateNote.isPending ? "Guardando..." : editingNote ? "Actualizar" : "Crear nota"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
