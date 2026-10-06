import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCommercialFollowupStatuses,
  useListInvoiceReminderStatuses,
  useListSubscriptionAlertStatuses,
  useListPaymentRecoveryStatuses,
  useListPendingProspectingAudits,
  useSubmitProspectingAuditReview,
  getListPendingProspectingAuditsQueryKey,
} from "@workspace/api-client-react";
import type { CommercialFollowupStatus, InvoiceReminderStatus, ProspectingAuditPending, SubscriptionAlertStatus, PaymentRecoveryStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Receipt, RefreshCw, CreditCard, ClipboardCheck } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";

const todayIso = () => new Date().toISOString().slice(0, 10);

function followupState(row: CommercialFollowupStatus): { label: string; color: string } {
  if (row.nextStage == null) return { label: "Completado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
  if ((row.nextStage === 3 || row.nextStage === 4) && !row.hasProposal) {
    return { label: "Bloqueado — sin propuesta", color: "bg-red-500/20 text-red-300 border-red-500/30" };
  }
  if (row.nextEligibleAt && row.nextEligibleAt.slice(0, 10) <= todayIso()) {
    return { label: `Etapa ${row.nextStage} — hoy`, color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  }
  return { label: `Etapa ${row.nextStage} — ${formatDate(row.nextEligibleAt)}`, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
}

function CommercialFollowupTab() {
  const { data, isLoading } = useListCommercialFollowupStatuses();
  const rows = data ?? [];
  const completado = rows.filter((r) => r.nextStage == null).length;
  const bloqueado = rows.filter((r) => (r.nextStage === 3 || r.nextStage === 4) && !r.hasProposal).length;
  const enProgreso = rows.length - completado - bloqueado;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">En progreso</div><div className="text-2xl font-bold text-blue-400">{enProgreso}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Bloqueados</div><div className="text-2xl font-bold text-red-400">{bloqueado}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Completados</div><div className="text-2xl font-bold text-emerald-400">{completado}</div></CardContent></Card>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Prospecto</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Etapas enviadas</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Última enviada</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const state = followupState(r);
                return (
                  <tr key={r.prospectId} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{r.prospectName}</div>
                      <div className="text-xs text-muted-foreground">{r.prospectEmail ?? "-"}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.company ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">{r.sentStages.length ? r.sentStages.join(", ") : "-"}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(r.lastSentAt)}</td>
                    <td className="p-3"><Badge variant="outline" className={state.color}>{state.label}</Badge></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sin prospectos en esta secuencia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function reminderState(windowStage: string | null, sentStages: string[]): { label: string; color: string } {
  if (windowStage == null) return { label: "Al día", color: "bg-muted text-muted-foreground border-border" };
  const sent = sentStages.includes(windowStage);
  if (windowStage === "overdue") {
    return sent
      ? { label: "Vencida — alertado", color: "bg-red-500/20 text-red-300 border-red-500/30" }
      : { label: "Vencida — pendiente", color: "bg-red-500/20 text-red-300 border-red-500/30" };
  }
  return sent
    ? { label: "Próxima — alertado", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" }
    : { label: "Próxima — pendiente", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
}

function InvoiceRemindersTab() {
  const { data, isLoading } = useListInvoiceReminderStatuses();
  const rows: InvoiceReminderStatus[] = data ?? [];
  const overdue = rows.filter((r) => r.staffWindowStage === "overdue" || r.clientWindowStage === "overdue").length;
  const upcoming = rows.filter((r) => (r.staffWindowStage === "upcoming" || r.clientWindowStage === "upcoming") && r.staffWindowStage !== "overdue" && r.clientWindowStage !== "overdue").length;
  const alDia = rows.length - overdue - upcoming;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Al día</div><div className="text-2xl font-bold text-emerald-400">{alDia}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Próximas</div><div className="text-2xl font-bold text-amber-400">{upcoming}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">Vencidas</div><div className="text-2xl font-bold text-red-400">{overdue}</div></CardContent></Card>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Factura</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Vence</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Staff</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const staff = reminderState(r.staffWindowStage, r.staffSentStages);
                const client = reminderState(r.clientWindowStage, r.clientSentStages);
                return (
                  <tr key={r.invoiceId} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-medium">{r.invoiceNumber}</td>
                    <td className="p-3 text-muted-foreground">{r.clientName}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(r.dueDate)}</td>
                    <td className="p-3"><Badge variant="outline" className={staff.color}>{staff.label}</Badge></td>
                    <td className="p-3"><Badge variant="outline" className={client.color}>{client.label}</Badge></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sin facturas en esta secuencia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// P-82 Agente Prospectador — manual-review queue for the 2 checklist items
// with no reliable API (abandonedSocial, noContentPublished). The other 8
// checklist items are a later phase (Google Places/PageSpeed APIs + HTML
// analysis — no API keys contracted yet), so every row here today is
// pending purely on these 2 answers.
function ProspectingAuditRow({ audit }: { audit: ProspectingAuditPending }) {
  const queryClient = useQueryClient();
  const [abandonedSocial, setAbandonedSocial] = useState(false);
  const [noContentPublished, setNoContentPublished] = useState(false);

  const { mutate: submit, isPending } = useSubmitProspectingAuditReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPendingProspectingAuditsQueryKey() });
      },
    },
  });

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="p-3">
        <div className="font-medium">{audit.prospectName}</div>
        <div className="text-xs text-muted-foreground">{audit.prospectPhone ?? "-"}</div>
      </td>
      <td className="p-3 text-muted-foreground">{audit.prospectIndustry ?? "-"}</td>
      <td className="p-3 text-muted-foreground">{formatDate(audit.createdAt)}</td>
      <td className="p-3">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={abandonedSocial} onCheckedChange={(v) => setAbandonedSocial(v === true)} />
          Redes sociales abandonadas
        </label>
      </td>
      <td className="p-3">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={noContentPublished} onCheckedChange={(v) => setNoContentPublished(v === true)} />
          Sin contenido publicado
        </label>
      </td>
      <td className="p-3">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => submit({ id: audit.diagnosisId, data: { abandonedSocial, noContentPublished } })}
        >
          {isPending ? "Enviando..." : "Enviar"}
        </Button>
      </td>
    </tr>
  );
}

function ProspectingAuditsTab() {
  const { data, isLoading } = useListPendingProspectingAudits();
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Solo los 2 puntos del checklist sin API confiable (redes abandonadas, sin contenido publicado). Los otros 8 se
        completan automáticamente en una fase posterior (Google Places/PageSpeed — aún sin contratar).
      </p>
      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Prospecto</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Industria</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Creado</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Redes abandonadas</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Sin contenido</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Acción</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => <ProspectingAuditRow key={r.diagnosisId} audit={r} />)}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin auditorías pendientes de revisión.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const BADGE_DONE = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
const BADGE_WAIT = "bg-blue-500/20 text-blue-300 border-blue-500/30";
const BADGE_DUE = "bg-amber-500/20 text-amber-300 border-amber-500/30";
const BADGE_BAD = "bg-red-500/20 text-red-300 border-red-500/30";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <Card><CardContent className="pt-4 pb-4"><div className="text-xs text-muted-foreground mb-1">{label}</div><div className={`text-2xl font-bold ${color}`}>{value}</div></CardContent></Card>;
}

// A subscription is created when a proposal's final cuota is paid, but
// billing only starts once the client approves it on PayPal. The cron
// alerts staff once it has waited 3+ days (subscription-alerts/eligibility).
function subscriptionAlertState(r: SubscriptionAlertStatus): { label: string; color: string } {
  if (r.status !== "pending_authorization") return { label: r.status === "active" ? "Autorizada" : r.status, color: BADGE_DONE };
  if (r.alertSentAt) return { label: `Alerta enviada ${formatDate(r.alertSentAt)}`, color: BADGE_BAD };
  if (r.stale) return { label: "+3 días sin autorizar", color: BADGE_DUE };
  return { label: "Esperando al cliente", color: BADGE_WAIT };
}

function SubscriptionAlertsTab() {
  const { data, isLoading } = useListSubscriptionAlertStatuses();
  const rows: SubscriptionAlertStatus[] = data ?? [];
  const waiting = rows.filter((r) => r.status === "pending_authorization").length;
  const stale = rows.filter((r) => r.status === "pending_authorization" && r.stale).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Esperando autorización" value={waiting} color="text-blue-400" />
        <StatCard label="+3 días sin autorizar" value={stale} color="text-amber-400" />
        <StatCard label="Resueltas" value={rows.length - waiting} color="text-emerald-400" />
      </div>
      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Mensualidad</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Creada</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const state = subscriptionAlertState(r);
                return (
                  <tr key={r.subscriptionId} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-medium">{r.clientName}</td>
                    <td className="p-3 text-muted-foreground">{formatCurrency(r.amount, r.currency)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="p-3"><Badge variant="outline" className={state.color}>{state.label}</Badge></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Ninguna suscripción esperando autorización.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const RECOVERY_LABELS: Record<string, string> = {
  reminder_24h: "Recordatorio 24h",
  discount_30d: "Descuento 30 días",
  discount_60d: "Descuento 60 días",
};

// Unpaid deposit cuotas: a 24h reminder, then 10% win-back discounts at 30
// and 60 days (payment-recovery/eligibility). "Rechazó" is the client
// explicitly declining — it stops the reminder, not the discounts.
function recoveryState(r: PaymentRecoveryStatus): { label: string; color: string } {
  if (r.invoiceStatus === "paid") return { label: "Pagada", color: BADGE_DONE };
  if (r.invoiceStatus !== "sent") return { label: r.invoiceStatus, color: BADGE_WAIT };
  if (!r.nextStage) return { label: "Secuencia completa", color: BADGE_BAD };
  const label = RECOVERY_LABELS[r.nextStage] ?? r.nextStage;
  if (r.nextEligibleAt && r.nextEligibleAt.slice(0, 10) <= todayIso()) return { label: `${label} — hoy`, color: BADGE_DUE };
  return { label: `${label} — ${formatDate(r.nextEligibleAt)}`, color: BADGE_WAIT };
}

function PaymentRecoveryTab() {
  const { data, isLoading } = useListPaymentRecoveryStatuses();
  const rows: PaymentRecoveryStatus[] = data ?? [];
  const open = rows.filter((r) => r.invoiceStatus === "sent").length;
  const declined = rows.filter((r) => r.declined).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Anticipos sin pagar" value={open} color="text-amber-400" />
        <StatCard label="Rechazaron" value={declined} color="text-red-400" />
        <StatCard label="Recuperadas" value={rows.filter((r) => r.invoiceStatus === "paid").length} color="text-emerald-400" />
      </div>
      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Factura</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Enviados</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Siguiente</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const state = recoveryState(r);
                return (
                  <tr key={r.invoiceId} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-medium">{r.invoiceNumber}</td>
                    <td className="p-3 text-muted-foreground">{r.clientName}{r.declined && <Badge variant="outline" className={`ml-2 ${BADGE_BAD}`}>Rechazó</Badge>}</td>
                    <td className="p-3 text-muted-foreground">{r.sentStages.length > 0 ? r.sentStages.map((st) => RECOVERY_LABELS[st] ?? st).join(", ") : "—"}</td>
                    <td className="p-3"><Badge variant="outline" className={state.color}>{state.label}</Badge></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Ningún anticipo en recuperación.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Sequences() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Secuencias Automatizadas</h1>
      </div>

      {/* Mirrors the crons commented out in api-server/src/index.ts (paused
          since 2026-08-17 until the first real subscription exists) —
          remove this notice when they are re-enabled. */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-3 text-xs text-amber-300">
          Los envíos automáticos de estas secuencias están en pausa hasta que exista la primera suscripción real. Esta vista muestra en qué etapa está cada caso y qué se enviaría al reactivarlas.
        </CardContent>
      </Card>

      <Tabs defaultValue="commercial-followup">
        <TabsList>
          <TabsTrigger value="commercial-followup" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Seguimiento Comercial</TabsTrigger>
          <TabsTrigger value="invoice-reminders" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Recordatorios de Factura</TabsTrigger>
          <TabsTrigger value="subscription-alerts" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Alertas de Suscripción</TabsTrigger>
          <TabsTrigger value="payment-recovery" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Recuperación de Pago</TabsTrigger>
          <TabsTrigger value="prospecting-audits" className="gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Auditoría de Prospección</TabsTrigger>
        </TabsList>

        <TabsContent value="commercial-followup"><CommercialFollowupTab /></TabsContent>
        <TabsContent value="invoice-reminders"><InvoiceRemindersTab /></TabsContent>
        <TabsContent value="subscription-alerts"><SubscriptionAlertsTab /></TabsContent>
        <TabsContent value="payment-recovery"><PaymentRecoveryTab /></TabsContent>
        <TabsContent value="prospecting-audits"><ProspectingAuditsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
