import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  listContentCalendarItems,
  getListContentCalendarItemsQueryKey,
  useSubmitContentCalendarItem,
  useApproveContentCalendarItem,
} from "@workspace/api-client-react";
import type { ContentCalendarItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Send, Check, Share2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Autopublicador Social</h1>
          {pendingCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">{pendingCount} pendientes</span>}
        </div>
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
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin borradores todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
