import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  listContentCalendarItems,
  getListContentCalendarItemsQueryKey,
  useSubmitContentCalendarItem,
  useApproveContentCalendarItem,
  useGenerateContentCalendarItem,
} from "@workspace/api-client-react";
import type { ContentCalendarItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send, Check, Share2, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const NETWORK_OPTIONS = [
  { value: "meta_facebook", label: "Facebook" },
  { value: "meta_instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
];

const EMPTY_GENERATE_FORM = { clientId: "", topic: "", tone: "", networks: [] as string[] };

// costUsd comes back as a decimal string (Drizzle numeric) — small values need
// more than 2 decimals to not just show "$0.00" for every real generation.
function formatCost(costUsd: string | null | undefined): string {
  if (costUsd == null) return "—";
  const n = Number(costUsd);
  if (n === 0) return "$0";
  return `$${n < 0.01 ? n.toFixed(6) : n.toFixed(4)}`;
}

// Aggregates content_calendar_items across every client — the API is
// client-scoped (/clients/:clientId/content-calendar/items), there is no
// cross-client list endpoint, so this fetches per-client via useQueries
// instead of adding a new backend endpoint just for this view.

const STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobado",
  published: "Publicado",
  failed: "Falló",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending_approval: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  published: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
};
const ALL_STATUSES = ["draft", "pending_approval", "approved", "published", "failed"];

type ItemWithClient = ContentCalendarItem & { clientName: string };

export function SocialAutopublisher() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ ...EMPTY_GENERATE_FORM });

  const { data: clients, isLoading: clientsLoading } = useListClients();

  const itemQueries = useQueries({
    queries: (clients ?? []).map((client) => ({
      queryKey: getListContentCalendarItemsQueryKey(client.id),
      queryFn: () => listContentCalendarItems(client.id),
    })),
  });

  const itemsLoading = clientsLoading || itemQueries.some((q) => q.isLoading);

  const items: ItemWithClient[] = (clients ?? []).flatMap((client, i) =>
    (itemQueries[i]?.data ?? []).map((item) => ({ ...item, clientName: client.name })),
  );

  const filtered = items.filter((i) => tab === "all" || i.status === tab);
  const pendingCount = items.filter((i) => i.status === "pending_approval").length;

  const invalidate = (clientId: number) => {
    qc.invalidateQueries({ queryKey: getListContentCalendarItemsQueryKey(clientId) });
  };

  const submit = useSubmitContentCalendarItem({
    mutation: {
      onSuccess: (_data, vars) => { invalidate(vars.clientId); toast({ title: "Enviado a aprobación" }); },
      onError: (err) => toast({ title: "No se pudo enviar a aprobación", description: String(err), variant: "destructive" }),
    },
  });
  const approve = useApproveContentCalendarItem({
    mutation: {
      onSuccess: (_data, vars) => { invalidate(vars.clientId); toast({ title: "Aprobado" }); },
      onError: (err) => toast({ title: "No se pudo aprobar", description: String(err), variant: "destructive" }),
    },
  });
  const generate = useGenerateContentCalendarItem({
    mutation: {
      onSuccess: (_data, vars) => {
        invalidate(vars.clientId);
        setGenerateOpen(false);
        setGenerateForm({ ...EMPTY_GENERATE_FORM });
        toast({ title: "Borrador generado con IA" });
      },
      onError: (err) => toast({ title: "No se pudo generar el borrador", description: String(err), variant: "destructive" }),
    },
  });

  const toggleNetwork = (value: string, checked: boolean) => {
    setGenerateForm((f) => ({
      ...f,
      networks: checked ? [...f.networks, value] : f.networks.filter((n) => n !== value),
    }));
  };

  const submitGenerate = () => {
    const clientId = parseInt(generateForm.clientId, 10);
    if (!clientId || !generateForm.topic.trim() || generateForm.networks.length === 0) return;
    generate.mutate({
      clientId,
      data: {
        topic: generateForm.topic.trim(),
        networks: generateForm.networks,
        tone: generateForm.tone.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Autopublicador Social</h1>
          {pendingCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">{pendingCount} pendientes</span>}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setGenerateOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" /> Generar con IA
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ key: "all", label: "Todos" }, ...ALL_STATUSES.map((s) => ({ key: s, label: STATUS_ES[s] }))].map(({ key, label }) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)} className="text-xs h-7">{label}</Button>
        ))}
      </div>

      {itemsLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Copy</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Redes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Costo IA</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Creado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.clientId}-${item.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.clientName}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md truncate" title={item.caption}>{item.caption}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.targets.map((t) => t.network).join(", ")}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[item.status] ?? STATUS_COLOR.draft}`}>{STATUS_ES[item.status] ?? item.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" title={item.generationModel ? `${item.generationModel} · ${item.generationInputTokens ?? 0} in / ${item.generationOutputTokens ?? 0} out tokens` : "Copy escrito manualmente"}>
                    {formatCost(item.generationCostUsd)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={submit.isPending} onClick={() => submit.mutate({ clientId: item.clientId, id: item.id })}>
                          <Send className="h-3 w-3" /> Enviar a aprobación
                        </Button>
                      )}
                      {item.status === "pending_approval" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" disabled={approve.isPending} onClick={() => approve.mutate({ clientId: item.clientId, id: item.id })}>
                          <Check className="h-3 w-3" /> Aprobar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin borradores todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generar borrador con IA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={generateForm.clientId} onValueChange={(v) => setGenerateForm({ ...generateForm, clientId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tema / brief</Label>
              <Textarea
                className="mt-1"
                placeholder="Ej: Promoción de fin de semana en el consultorio, enfocada en pacientes nuevos"
                value={generateForm.topic}
                onChange={(e) => setGenerateForm({ ...generateForm, topic: e.target.value })}
              />
            </div>
            <div>
              <Label>Tono (opcional)</Label>
              <Input
                className="mt-1"
                placeholder="Ej: cercano y profesional"
                value={generateForm.tone}
                onChange={(e) => setGenerateForm({ ...generateForm, tone: e.target.value })}
              />
            </div>
            <div>
              <Label>Redes</Label>
              <div className="mt-2 flex gap-4">
                {NETWORK_OPTIONS.map((n) => (
                  <label key={n.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={generateForm.networks.includes(n.value)}
                      onCheckedChange={(checked) => toggleNetwork(n.value, checked === true)}
                    />
                    {n.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={generate.isPending || !generateForm.clientId || !generateForm.topic.trim() || generateForm.networks.length === 0}
              onClick={submitGenerate}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> {generate.isPending ? "Generando..." : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
