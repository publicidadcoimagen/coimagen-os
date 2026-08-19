import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCommercialFollowupStatuses,
  useListInvoiceReminderStatuses,
  useListPendingProspectingAudits,
  useSubmitProspectingAuditReview,
  getListPendingProspectingAuditsQueryKey,
} from "@workspace/api-client-react";
import type { CommercialFollowupStatus, InvoiceReminderStatus, ProspectingAuditPending } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Receipt, RefreshCw, CreditCard, ClipboardCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

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

function ComingSoonTab({ reason }: { reason: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        <p>Próximamente.</p>
        <p className="text-xs mt-1">{reason}</p>
      </CardContent>
    </Card>
  );
}

export function Sequences() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Secuencias Automatizadas</h1>
      </div>

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
        <TabsContent value="subscription-alerts">
          <ComingSoonTab reason="Tabla subscription_alerts vive en feature/paypal-payments, aún sin mergear a main." />
        </TabsContent>
        <TabsContent value="payment-recovery">
          <ComingSoonTab reason="Tabla payment_recovery_alerts vive en feature/paypal-payments, aún sin mergear a main." />
        </TabsContent>
        <TabsContent value="prospecting-audits"><ProspectingAuditsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
