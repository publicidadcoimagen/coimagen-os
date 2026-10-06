import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProposals,
  useCreateProposal,
  useUpdateProposal,
  useListProspects,
  useListClients,
  getListProposalsQueryKey,
  getListProspectsQueryKey,
  getListClientsQueryKey,
  useCreateContractFromProposal,
  getListContractsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Copy, FileSignature } from "lucide-react";
import { formatDate, formatCurrency, formatCurrencyBreakdown } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

// Same pattern as commercial/diagnosis.tsx's PUBLIC_RESULTS_BASE_URL — the
// public, unauthenticated page a client sees to accept a proposal (and pay
// the first invoice once accepted). Before this button existed, a proposal
// created manually for an already-qualified prospect (i.e. outside
// commercial-followup's automated correo 3/4, which only fires for
// status="lead" prospects still in the digital-diagnosis funnel) had no way
// for non-technical staff to get this URL to the client at all.
const PUBLIC_PROPOSAL_BASE_URL = "https://www.coimagenmedia.com/propuesta";

const STATUS_ES: Record<string, string> = { draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", rejected: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STATUSES = ["draft", "sent", "accepted", "rejected"];
// "accepted" is deliberately excluded here: it must only ever be set by the
// client approving from their public proposal link (/propuesta/:token),
// which also generates the payment-schedule invoices. Creating a proposal
// already "accepted" from this dialog skipped that invoice generation
// silently — see backend guard in proposals.ts.
const CREATABLE_STATUSES = ["draft", "sent", "rejected"];

export function Proposals() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const { data: proposals, isLoading } = useListProposals({}, { query: { queryKey: getListProposalsQueryKey() } });
  const { data: prospects } = useListProspects({}, { query: { queryKey: getListProspectsQueryKey() } });
  const { data: clients } = useListClients({ query: { queryKey: getListClientsQueryKey() } });
  const createProposal = useCreateProposal();
  const [open, setOpen] = useState(false);
  // amount defaults to "0", not "", and is never allowed to go blank (see
  // onBlur below) — a blank amount used to become `undefined` on submit,
  // which the API then stored as `amount: null`. That silently broke the
  // Founders pricing rule (their setup amount must be an explicit $0, not
  // absent) and any other proposal where staff simply forgot to type a
  // number. The conversion flow already throws a clear error on a null
  // amount (payment-schedule/repository.ts) — this closes the gap before
  // that point instead of relying on that guard to catch it.
  const emptyForm = { title: "", amount: "0", status: "draft", validUntil: "", notes: "", link: "none" };
  const [form, setForm] = useState(emptyForm);

  const filtered = proposals?.filter((p) => tab === "all" || p.status === tab) ?? [];

  const amountValue = Number(form.amount);
  const isAmountValid = form.amount !== "" && !Number.isNaN(amountValue) && amountValue >= 0;

  const handleAmountBlur = () => {
    if (!isAmountValid) setForm((f) => ({ ...f, amount: "0" }));
  };

  // Without a prospectId/clientId, the conversion flow (POST /prospects/:id/convert)
  // and commercial-followup's correo 3/4 have nothing to link this proposal to — the
  // only way to reach either today would be staff calling the API directly. See
  // docs/prospect-to-client-conversion.md.
  const [linkKind, linkId] = form.link === "none" ? [null, null] : (form.link.split(":") as ["prospect" | "client", string]);

  const handleSubmit = () => {
    if (!form.title || !isAmountValid) return;
    createProposal.mutate({
      data: {
        title: form.title,
        amount: amountValue,
        status: form.status as "draft",
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
        prospectId: linkKind === "prospect" ? Number(linkId) : undefined,
        clientId: linkKind === "client" ? Number(linkId) : undefined,
      },
    }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProposalsQueryKey() }); setOpen(false); setForm(emptyForm); }
    });
  };

  const prospectName = (id: number) => prospects?.find((p) => p.id === id)?.name;
  const clientName = (id: number) => clients?.find((c) => c.id === id)?.name;

  const handleCopyLink = async (publicToken: string) => {
    const url = `${PUBLIC_PROPOSAL_BASE_URL}/${publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Enlace copiado", description: url });
    } catch {
      // Clipboard API can be unavailable (older browser, non-HTTPS
      // context) — surface the URL itself so staff can still select and
      // copy it manually instead of a silent failure.
      toast({ title: "No se pudo copiar automáticamente", description: url, variant: "destructive" });
    }
  };

  // Per currency — MXN and USD proposals are never summed together.
  const acceptedTotals = new Map<string, number>();
  for (const p of proposals ?? []) {
    if (p.status === "accepted" && p.amount != null) acceptedTotals.set(p.currency, (acceptedTotals.get(p.currency) ?? 0) + p.amount);
  }
  const totalAccepted = [...acceptedTotals.entries()].map(([currency, amount]) => ({ currency, amount }));

  const [contractFor, setContractFor] = useState<{ id: number; title: string } | null>(null);
  const [contractType, setContractType] = useState("starter");
  const createContract = useCreateContractFromProposal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContractsQueryKey() });
        setContractFor(null);
        toast({ title: "Contrato generado", description: "Quedó como borrador en Contratos, listo para revisar y enviar a firma." });
      },
      onError: (err) => {
        const code = (err as { data?: { error?: string } })?.data?.error;
        const messages: Record<string, string> = {
          contract_already_exists: "Esta propuesta ya tiene un contrato. Búscalo en Contratos.",
          proposal_not_converted: "Primero convierte el prospecto en cliente.",
          proposal_not_accepted: "La propuesta todavía no está aceptada.",
          proposal_has_no_amount: "La propuesta no tiene monto.",
        };
        toast({ title: "No se pudo generar el contrato", description: messages[code ?? ""] ?? "Error inesperado.", variant: "destructive" });
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Propuestas</h1>
          <Badge variant="outline">{filtered.length}</Badge>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Propuesta</Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", ...STATUSES].map((s) => (
            <Button key={s} size="sm" variant={tab === s ? "default" : "outline"} onClick={() => setTab(s)} className="text-xs h-7">
              {s === "all" ? "Todas" : STATUS_ES[s]}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Valor cerrado: <span className="text-emerald-400 font-semibold">{formatCurrencyBreakdown(totalAccepted)}</span></span>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vinculado a</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Monto</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Válida hasta</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Enlace</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.clientId != null ? (clientName(p.clientId) ?? `Cliente #${p.clientId}`)
                      : p.prospectId != null ? (prospectName(p.prospectId) ?? `Prospecto #${p.prospectId}`)
                      : <span className="italic">Sin vincular</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCurrency(p.amount, p.currency)}
                    {p.monthlyAmount != null && <div className="text-xs text-muted-foreground">+ {formatCurrency(p.monthlyAmount, p.currency)}/mes</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.validUntil)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[p.status]}`}>{STATUS_ES[p.status] ?? p.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={!p.publicToken} onClick={() => p.publicToken && handleCopyLink(p.publicToken)}>
                      <Copy className="h-3.5 w-3.5" /> Copiar enlace
                    </Button>
                    {p.status === "accepted" && p.clientId != null && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setContractFor({ id: p.id, title: p.title })}>
                        <FileSignature className="h-3.5 w-3.5" /> Generar contrato
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin propuestas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={contractFor !== null} onOpenChange={(o) => { if (!o) setContractFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Generar contrato</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se creará un contrato en borrador para «{contractFor?.title}», vinculado al cliente y con el monto de la propuesta. Después lo revisas y lo envías a firma desde Contratos.
          </p>
          <div className="space-y-1.5">
            <Label>Tipo de contrato</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Contrato Starter</SelectItem>
                <SelectItem value="growth">Contrato Growth</SelectItem>
                <SelectItem value="automation">Contrato Automation</SelectItem>
                <SelectItem value="ai_business">Contrato AI Business</SelectItem>
                <SelectItem value="ecommerce">Contrato Ecommerce</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractFor(null)}>Cancelar</Button>
            <Button disabled={createContract.isPending} onClick={() => contractFor && createContract.mutate({ id: contractFor.id, data: { type: contractType } })}>
              {createContract.isPending ? "Generando..." : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Propuesta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Vincular a</Label>
              <Select value={form.link} onValueChange={(v) => setForm({ ...form, link: v })}>
                <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vincular</SelectItem>
                  <SelectGroup>
                    <SelectLabel>Prospectos</SelectLabel>
                    {prospects?.map((p) => <SelectItem key={`prospect:${p.id}`} value={`prospect:${p.id}`}>{p.name}{p.company ? ` — ${p.company}` : ""}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Clientes</SelectLabel>
                    {clients?.map((c) => <SelectItem key={`client:${c.id}`} value={`client:${c.id}`}>{c.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto (USD) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} onBlur={handleAmountBlur} placeholder="0.00" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CREATABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_ES[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Válida hasta</Label><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.title || !isAmountValid || createProposal.isPending}>{createProposal.isPending ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
