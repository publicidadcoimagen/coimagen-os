import { useState, useEffect, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSmartOnboarding,
  getGetSmartOnboardingQueryKey,
  getListSmartOnboardingsQueryKey,
  useUpdateSmartOnboarding,
  useCompleteSmartOnboarding,
  useListMundos,
  getListMundosQueryKey,
  useListDirectors,
  getListDirectorsQueryKey,
  useListAgents,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, ChevronRight, ArrowLeft, Save, CheckCircle2,
  AlertCircle, Globe2, User, Bot, Info, Lock, ExternalLink,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SERVICES = [
  "Marketing Digital", "SEO", "Google Business", "Sitio Web",
  "Landing Pages", "Automatización", "AI Agents", "Medical OS",
  "Restaurant OS", "Law OS", "Real Estate OS", "Cloud Systems",
  "Consultoría", "Otro",
] as const;

const ACCESS_PLATFORMS = [
  "Dominio", "Hosting", "Google", "Facebook", "Instagram",
  "TikTok", "LinkedIn", "YouTube", "Analytics", "Search Console",
  "Google Business", "Jotform", "OpenAI", "Anthropic", "Replit",
  "GitHub", "Otros",
] as const;

const INDUSTRIES = [
  "Salud", "Educación", "Tecnología", "Retail", "Gastronomía",
  "Inmobiliaria", "Legal", "Finanzas", "Marketing", "Construcción",
  "Manufactura", "Transporte", "Entretenimiento", "Turismo", "Otro",
];

const STEP_LABELS = [
  "Información General",
  "Servicios contratados",
  "Objetivos",
  "Accesos",
  "Branding",
  "Documentación",
  "Asignación Inteligente",
];

const STEP_ICONS = ["🏢", "📦", "🎯", "🔐", "🎨", "📄", "🤖"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Step1 = {
  companyName: string; tradeName: string; legalName: string;
  industry: string; country: string; city: string; website: string;
  socialMedia: { facebook: string; instagram: string; tiktok: string; linkedin: string; youtube: string };
  contactName: string; email: string; whatsapp: string;
};
type Step2 = { services: string[] };
type Step3 = { objectives: string; currentProblems: string; competition: string; expectedKpis: string; priority: string };
type Step4Entry = { platform: string; loginUrl: string; username: string; password: string; apiKey: string; notes: string };
type Step4 = { entries: Step4Entry[] };
type Step5 = { logoUrl: string; colors: string; typography: string; brandManualUrl: string; photosNotes: string; videosNotes: string; filesNotes: string; notes: string };
type Step6 = { contractUrl: string; ndaUrl: string; briefUrl: string; surveysNotes: string; filesNotes: string; notes: string };
type Step7 = { mundoId: number | null; directorId: number | null; agentIds: number[]; notes: string };

const D1: Step1 = { companyName: "", tradeName: "", legalName: "", industry: "", country: "", city: "", website: "", socialMedia: { facebook: "", instagram: "", tiktok: "", linkedin: "", youtube: "" }, contactName: "", email: "", whatsapp: "" };
const D2: Step2 = { services: [] };
const D3: Step3 = { objectives: "", currentProblems: "", competition: "", expectedKpis: "", priority: "medium" };
const D4: Step4 = { entries: ACCESS_PLATFORMS.map((p) => ({ platform: p, loginUrl: "", username: "", password: "", apiKey: "", notes: "" })) };
const D5: Step5 = { logoUrl: "", colors: "", typography: "", brandManualUrl: "", photosNotes: "", videosNotes: "", filesNotes: "", notes: "" };
const D6: Step6 = { contractUrl: "", ndaUrl: "", briefUrl: "", surveysNotes: "", filesNotes: "", notes: "" };
const D7: Step7 = { mundoId: null, directorId: null, agentIds: [], notes: "" };

function fromDb<T>(raw: unknown, def: T): T {
  if (!raw || typeof raw !== "object") return def;
  return { ...def, ...(raw as Partial<T>) };
}

// ─── Step Forms ───────────────────────────────────────────────────────────────
function Step1Form({ data, onChange }: { data: Step1; onChange: (d: Step1) => void }) {
  const set = (k: keyof Step1, v: string) => onChange({ ...data, [k]: v });
  const setSm = (k: string, v: string) => onChange({ ...data, socialMedia: { ...data.socialMedia, [k]: v } });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5 md:col-span-2"><Label>Nombre comercial *</Label><Input value={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Empresa XYZ" /></div>
        <div className="space-y-1.5"><Label>Nombre legal / Razón social</Label><Input value={data.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Empresa XYZ S.A.C." /></div>
        <div className="space-y-1.5"><Label>Nombre de marca</Label><Input value={data.tradeName} onChange={(e) => set("tradeName", e.target.value)} placeholder="XYZ Studio" /></div>
        <div className="space-y-1.5">
          <Label>Industria</Label>
          <Select value={data.industry} onValueChange={(v) => set("industry", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar industria" /></SelectTrigger>
            <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>País</Label><Input value={data.country} onChange={(e) => set("country", e.target.value)} placeholder="Perú" /></div>
        <div className="space-y-1.5"><Label>Ciudad</Label><Input value={data.city} onChange={(e) => set("city", e.target.value)} placeholder="Lima" /></div>
        <div className="space-y-1.5"><Label>Sitio web</Label><Input value={data.website} onChange={(e) => set("website", e.target.value)} placeholder="https://empresa.com" /></div>
      </div>
      <div>
        <Label className="mb-2 block">Redes sociales</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(["facebook", "instagram", "tiktok", "linkedin", "youtube"] as const).map((net) => (
            <Input key={net} value={data.socialMedia[net]} onChange={(e) => setSm(net, e.target.value)} placeholder={`${net.charAt(0).toUpperCase() + net.slice(1)} URL`} />
          ))}
        </div>
      </div>
      <div className="border-t border-border/30 pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacto principal</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Nombre *</Label><Input value={data.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="María García" /></div>
          <div className="space-y-1.5"><Label>Email *</Label><Input value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="maria@empresa.com" type="email" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={data.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+51 999 000 000" /></div>
        </div>
      </div>
    </div>
  );
}

function Step2Form({ data, onChange }: { data: Step2; onChange: (d: Step2) => void }) {
  const toggle = (service: string) => {
    const services = data.services.includes(service)
      ? data.services.filter((s) => s !== service)
      : [...data.services, service];
    onChange({ services });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Selecciona todos los servicios contratados por este cliente.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {SERVICES.map((s) => {
          const active = data.services.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`text-left p-3 rounded-lg border text-sm transition-all ${
                active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full mr-2 ${active ? "bg-primary" : "bg-muted"}`} />
              {s}
            </button>
          );
        })}
      </div>
      {data.services.length > 0 && (
        <p className="text-xs text-muted-foreground">{data.services.length} servicio{data.services.length !== 1 ? "s" : ""} seleccionado{data.services.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

function Step3Form({ data, onChange }: { data: Step3; onChange: (d: Step3) => void }) {
  const set = (k: keyof Step3, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Objetivos del cliente *</Label>
        <Textarea rows={3} value={data.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder="¿Qué quiere lograr el cliente con este servicio?" />
      </div>
      <div className="space-y-1.5">
        <Label>Problemas actuales</Label>
        <Textarea rows={3} value={data.currentProblems} onChange={(e) => set("currentProblems", e.target.value)} placeholder="¿Cuáles son los principales problemas o dolor que tiene?" />
      </div>
      <div className="space-y-1.5">
        <Label>Competencia</Label>
        <Textarea rows={2} value={data.competition} onChange={(e) => set("competition", e.target.value)} placeholder="Principales competidores del cliente..." />
      </div>
      <div className="space-y-1.5">
        <Label>KPIs esperados</Label>
        <Textarea rows={2} value={data.expectedKpis} onChange={(e) => set("expectedKpis", e.target.value)} placeholder="Incrementar ventas 30%, 10k seguidores, ranking página 1..." />
      </div>
      <div className="space-y-1.5">
        <Label>Prioridad</Label>
        <Select value={data.priority} onValueChange={(v) => set("priority", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Step4Form({ data, onChange }: { data: Step4; onChange: (d: Step4) => void }) {
  const updateEntry = (i: number, field: keyof Step4Entry, value: string) => {
    const entries = [...data.entries];
    entries[i] = { ...entries[i], [field]: value };
    onChange({ entries });
  };
  const SENTINEL = "••••••••";
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300">
        <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Las contraseñas y API keys se almacenan <strong>cifradas con AES-256-GCM</strong>. Ingresa los datos y se encriptarán al guardar. Los campos que muestren ••••••••  ya tienen un valor cifrado.</span>
      </div>
      <div className="space-y-3">
        {data.entries.map((entry, i) => (
          <Card key={entry.platform} className="border-border/40">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{entry.platform}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="URL de acceso"
                  value={entry.loginUrl}
                  onChange={(e) => updateEntry(i, "loginUrl", e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Usuario / Email"
                  value={entry.username}
                  onChange={(e) => updateEntry(i, "username", e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder={entry.password === SENTINEL ? "••••••••  (cifrado)" : "Contraseña"}
                  value={entry.password === SENTINEL ? "" : entry.password}
                  onChange={(e) => updateEntry(i, "password", e.target.value)}
                  type="password"
                  className="text-xs h-8"
                />
                <Input
                  placeholder={entry.apiKey === SENTINEL ? "••••••••  (cifrado)" : "API Key / Token"}
                  value={entry.apiKey === SENTINEL ? "" : entry.apiKey}
                  onChange={(e) => updateEntry(i, "apiKey", e.target.value)}
                  type="password"
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Notas"
                  value={entry.notes}
                  onChange={(e) => updateEntry(i, "notes", e.target.value)}
                  className="text-xs h-8 md:col-span-2"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Step5Form({ data, onChange }: { data: Step5; onChange: (d: Step5) => void }) {
  const set = (k: keyof Step5, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>La integración con Google Drive para subida de archivos se habilitará próximamente. Por ahora ingresa URLs o describe los activos disponibles.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>URL del logo</Label><Input value={data.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://drive.google.com/..." /></div>
        <div className="space-y-1.5"><Label>Colores de marca</Label><Input value={data.colors} onChange={(e) => set("colors", e.target.value)} placeholder="#FF6B35, #004E89, #FFFFFF" /></div>
        <div className="space-y-1.5"><Label>Tipografía</Label><Input value={data.typography} onChange={(e) => set("typography", e.target.value)} placeholder="Montserrat, Open Sans" /></div>
        <div className="space-y-1.5"><Label>Manual de marca (URL)</Label><Input value={data.brandManualUrl} onChange={(e) => set("brandManualUrl", e.target.value)} placeholder="https://..." /></div>
        <div className="space-y-1.5"><Label>Fotografías <span className="text-[10px] text-muted-foreground">(notas o URLs)</span></Label><Textarea rows={2} value={data.photosNotes} onChange={(e) => set("photosNotes", e.target.value)} placeholder="Carpeta Drive, stock, etc." /></div>
        <div className="space-y-1.5"><Label>Videos <span className="text-[10px] text-muted-foreground">(notas o URLs)</span></Label><Textarea rows={2} value={data.videosNotes} onChange={(e) => set("videosNotes", e.target.value)} placeholder="YouTube, Drive..." /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Archivos adicionales</Label><Textarea rows={2} value={data.filesNotes} onChange={(e) => set("filesNotes", e.target.value)} placeholder="Otros archivos de branding..." /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Notas adicionales</Label><Textarea rows={2} value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones sobre el branding..." /></div>
      </div>
    </div>
  );
}

function Step6Form({ data, onChange }: { data: Step6; onChange: (d: Step6) => void }) {
  const set = (k: keyof Step6, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Integración con Jotform y Google Drive disponible próximamente para gestión documental automatizada.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>Contrato (URL o nombre)</Label><Input value={data.contractUrl} onChange={(e) => set("contractUrl", e.target.value)} placeholder="Contrato_ClienteXYZ.pdf" /></div>
        <div className="space-y-1.5"><Label>NDA / Confidencialidad</Label><Input value={data.ndaUrl} onChange={(e) => set("ndaUrl", e.target.value)} placeholder="NDA_ClienteXYZ.pdf" /></div>
        <div className="space-y-1.5"><Label>Brief creativo</Label><Input value={data.briefUrl} onChange={(e) => set("briefUrl", e.target.value)} placeholder="Brief_ClienteXYZ.pdf" /></div>
        <div className="space-y-1.5"><Label>Cuestionarios</Label><Textarea rows={2} value={data.surveysNotes} onChange={(e) => set("surveysNotes", e.target.value)} placeholder="Jotform URL, cuestionario completado..." /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Archivos adicionales</Label><Textarea rows={2} value={data.filesNotes} onChange={(e) => set("filesNotes", e.target.value)} placeholder="PDFs, presentaciones, etc." /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Notas</Label><Textarea rows={2} value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones sobre la documentación..." /></div>
      </div>
    </div>
  );
}

function Step7Form({ data, onChange }: { data: Step7; onChange: (d: Step7) => void }) {
  const { data: mundos = [] } = useListMundos({ query: { queryKey: getListMundosQueryKey() } });
  const { data: directors = [] } = useListDirectors({ query: { queryKey: getListDirectorsQueryKey() } });
  const { data: agents = [] } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });

  const toggleAgent = (id: number) => {
    const ids = data.agentIds.includes(id) ? data.agentIds.filter((a) => a !== id) : [...data.agentIds, id];
    onChange({ ...data, agentIds: ids });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary/80">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>La asignación inteligente sugiere el Mundo, Director y Agentes basándose en los servicios y objetivos del cliente. Ajusta manualmente si es necesario.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />Mundo</Label>
          <Select value={data.mundoId ? String(data.mundoId) : ""} onValueChange={(v) => onChange({ ...data, mundoId: v ? Number(v) : null })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar mundo" /></SelectTrigger>
            <SelectContent>
              {(mundos as { id: number; name: string }[]).map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Director</Label>
          <Select value={data.directorId ? String(data.directorId) : ""} onValueChange={(v) => onChange({ ...data, directorId: v ? Number(v) : null })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar director" /></SelectTrigger>
            <SelectContent>
              {(directors as { id: number; name: string }[]).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" />Agentes asignados</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(agents as { id: number; name: string; role: string; category?: string | null }[]).map((agent) => {
            const active = data.agentIds.includes(agent.id);
            return (
              <button key={agent.id} onClick={() => toggleAgent(agent.id)} className={`text-left p-2.5 rounded-lg border text-xs transition-all ${active ? "border-primary/50 bg-primary/10" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-[10px] opacity-60 truncate">{agent.role}</p>
              </button>
            );
          })}
        </div>
        {data.agentIds.length > 0 && <p className="text-xs text-muted-foreground">{data.agentIds.length} agente{data.agentIds.length !== 1 ? "s" : ""} asignado{data.agentIds.length !== 1 ? "s" : ""}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Notas de asignación</Label>
        <Textarea rows={2} value={data.notes} onChange={(e) => onChange({ ...data, notes: e.target.value })} placeholder="Razones de asignación, instrucciones especiales..." />
      </div>
      <div className="border-t border-border/30 pt-3">
        <p className="text-[10px] text-muted-foreground/50">
          Las <strong>Automatizaciones</strong>, <strong>Proyecto</strong> y <strong>Backlog</strong> se generarán automáticamente al completar el onboarding.
          Integración futura con n8n, Google Drive y Google Calendar.
        </p>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ entities }: { entities: Record<string, unknown> }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
      <div className="h-16 w-16 rounded-full bg-green-400/15 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold">¡Onboarding completado!</h2>
        <p className="text-sm text-muted-foreground mt-1">El cliente ha sido incorporado exitosamente al sistema.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { label: "Cliente creado", value: entities.clientName as string, href: `/clients/${entities.clientId}` },
          { label: "Proyecto creado", value: entities.projectName as string, href: `/projects/${entities.projectId}` },
          { label: "Backlog generado", value: `${(entities.backlogItemIds as unknown[])?.length ?? 0} ítems`, href: "/backlog" },
        ].map(({ label, value, href }) => (
          <Card key={label} className="border-green-400/20">
            <CardContent className="p-3 text-left">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold mt-0.5 truncate">{value || "—"}</p>
              {href && (
                <Link href={href}>
                  <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1">
                    Ver <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/onboarding"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Volver al listado</Link>
        </Button>
        {entities.clientId != null && (
          <Button size="sm" asChild>
            <Link href={`/clients/${entities.clientId}`}>Ver perfil del cliente</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export function SmartOnboardingWizard() {
  const [, params] = useRoute("/onboarding/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();

  const { data: raw, isLoading, error } = useGetSmartOnboarding(id, {
    query: { queryKey: getGetSmartOnboardingQueryKey(id), enabled: id > 0 },
  });

  const [active, setActive] = useState(1);
  const [step1, setStep1] = useState<Step1>(D1);
  const [step2, setStep2] = useState<Step2>(D2);
  const [step3, setStep3] = useState<Step3>(D3);
  const [step4, setStep4] = useState<Step4>(D4);
  const [step5, setStep5] = useState<Step5>(D5);
  const [step6, setStep6] = useState<Step6>(D6);
  const [step7, setStep7] = useState<Step7>(D7);
  const [completed, setCompleted] = useState(false);
  const [completedEntities, setCompletedEntities] = useState<Record<string, unknown>>({});

  const ob = raw as { id: number; status: string; currentStep: number; step1?: unknown; step2?: unknown; step3?: unknown; step4?: unknown; step5?: unknown; step6?: unknown; step7?: unknown; completedEntities?: unknown } | undefined;

  useEffect(() => {
    if (!ob) return;
    if (ob.status === "completed") {
      setCompleted(true);
      setCompletedEntities((ob.completedEntities as Record<string, unknown>) ?? {});
      return;
    }
    setActive(ob.currentStep ?? 1);
    if (ob.step1) setStep1(fromDb(ob.step1, D1));
    if (ob.step2) setStep2(fromDb(ob.step2, D2));
    if (ob.step3) setStep3(fromDb(ob.step3, D3));
    if (ob.step4) {
      const s4 = fromDb<Step4>(ob.step4, D4);
      const merged: Step4Entry[] = ACCESS_PLATFORMS.map((p) => {
        const existing = s4.entries?.find((e) => e.platform === p);
        return existing ?? { platform: p, loginUrl: "", username: "", password: "", apiKey: "", notes: "" };
      });
      setStep4({ entries: merged });
    }
    if (ob.step5) setStep5(fromDb(ob.step5, D5));
    if (ob.step6) setStep6(fromDb(ob.step6, D6));
    if (ob.step7) setStep7(fromDb(ob.step7, D7));
  }, [ob?.id, ob?.status]);

  const { mutate: updateOb, isPending: saving } = useUpdateSmartOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSmartOnboardingQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListSmartOnboardingsQueryKey() });
      },
    },
  });

  const { mutate: completeOb, isPending: completing } = useCompleteSmartOnboarding({
    mutation: {
      onSuccess: (result) => {
        const r = result as { completedEntities?: Record<string, unknown>; status: string };
        queryClient.invalidateQueries({ queryKey: getGetSmartOnboardingQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListSmartOnboardingsQueryKey() });
        setCompleted(true);
        setCompletedEntities(r.completedEntities ?? {});
      },
    },
  });

  const getStepData = useCallback((step: number): Record<string, unknown> => {
    if (step === 1) return step1 as unknown as Record<string, unknown>;
    if (step === 2) return step2 as unknown as Record<string, unknown>;
    if (step === 3) return step3 as unknown as Record<string, unknown>;
    if (step === 4) return step4 as unknown as Record<string, unknown>;
    if (step === 5) return step5 as unknown as Record<string, unknown>;
    if (step === 6) return step6 as unknown as Record<string, unknown>;
    return step7 as unknown as Record<string, unknown>;
  }, [step1, step2, step3, step4, step5, step6, step7]);

  const saveDraft = (nextStep?: number) => {
    const stepKey = `step${active}` as "step1";
    updateOb({
      id,
      data: {
        [stepKey]: getStepData(active),
        currentStep: nextStep ?? active,
        status: "in_progress",
      },
    });
  };

  const handleNext = () => {
    if (active < 7) { saveDraft(active + 1); setActive((s) => s + 1); }
  };

  const handleComplete = () => {
    const stepKey = `step${active}` as "step7";
    updateOb(
      { id, data: { [stepKey]: getStepData(active), status: "in_progress" } },
      { onSuccess: () => completeOb({ id }) }
    );
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground animate-pulse">Cargando onboarding...</p>
    </div>
  );

  if (error || !ob) return (
    <div className="flex flex-col items-center gap-3 min-h-[60vh] justify-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Onboarding no encontrado</p>
      <Button variant="outline" size="sm" asChild><Link href="/onboarding"><ArrowLeft className="h-4 w-4 mr-1.5" />Volver</Link></Button>
    </div>
  );

  const progress = completed ? 100 : Math.round(((active - 1) / 7) * 100);

  if (completed) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/onboarding" className="hover:text-foreground flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />Onboarding
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Completado</span>
        </div>
        <SuccessScreen entities={completedEntities} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/onboarding" className="hover:text-foreground flex items-center gap-1">
          <ClipboardList className="h-3 w-3" />Onboarding
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">
          {(ob.step1 as Step1 | null | undefined)?.companyName || `Onboarding #${id}`}
        </span>
      </div>

      {/* Header + Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Smart Client Onboarding</h1>
            <p className="text-xs text-muted-foreground">Etapa {active} de 7 — {STEP_LABELS[active - 1]}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {progress}% completado
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between overflow-x-auto pb-1">
        {STEP_LABELS.map((label, idx) => {
          const step = idx + 1;
          const isActive = step === active;
          const isDone = step < active;
          return (
            <button
              key={step}
              onClick={() => { if (isDone || step === active) { saveDraft(step); setActive(step); } }}
              disabled={step > active}
              className={`flex flex-col items-center gap-1 min-w-[60px] transition-all ${step > active ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                isDone ? "bg-primary border-primary text-primary-foreground" :
                isActive ? "border-primary bg-primary/15 text-primary" :
                "border-border text-muted-foreground"
              }`}>
                {isDone ? "✓" : STEP_ICONS[idx]}
              </div>
              <span className={`text-[9px] text-center leading-tight max-w-[56px] ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span>{STEP_ICONS[active - 1]}</span>
            {STEP_LABELS[active - 1]}
          </h2>
          {active === 1 && <Step1Form data={step1} onChange={setStep1} />}
          {active === 2 && <Step2Form data={step2} onChange={setStep2} />}
          {active === 3 && <Step3Form data={step3} onChange={setStep3} />}
          {active === 4 && <Step4Form data={step4} onChange={setStep4} />}
          {active === 5 && <Step5Form data={step5} onChange={setStep5} />}
          {active === 6 && <Step6Form data={step6} onChange={setStep6} />}
          {active === 7 && <Step7Form data={step7} onChange={setStep7} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={() => saveDraft()} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Guardando..." : "Guardar borrador"}
        </Button>
        <div className="flex gap-2">
          {active > 1 && (
            <Button variant="outline" size="sm" onClick={() => setActive((s) => s - 1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Anterior
            </Button>
          )}
          {active < 7 && (
            <Button size="sm" onClick={handleNext} disabled={saving}>
              Siguiente<ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
          {active === 7 && (
            <Button size="sm" onClick={handleComplete} disabled={completing || saving} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {completing ? "Procesando..." : "Completar Onboarding"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
