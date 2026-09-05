import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListContentCalendarItems, getListContentCalendarItemsQueryKey,
  useApproveContentCalendarItem,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Check, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

type Org = { id: number; slug: string; name: string; clientId?: number | null };

export function ClientAutopublicador() {
  const [, params] = useRoute("/client/:slug/autopublicador");
  const slug = params?.slug ?? "";
  return (
    <ClientRoomLayout slug={slug}>
      <ClientAutopublicadorBody slug={slug} />
    </ClientRoomLayout>
  );
}

// useLang() must run inside LanguageProvider's subtree, which ClientRoomLayout
// mounts as a child — calling it in the exported route component (an ancestor
// of ClientRoomLayout) throws on every render (fixed 2026-08-26, same fix as ai.tsx).
function ClientAutopublicadorBody({ slug }: { slug: string }) {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;
  const clientId = org?.clientId ?? 0;

  const { data: items, isLoading } = useListContentCalendarItems(clientId, {
    query: { queryKey: getListContentCalendarItemsQueryKey(clientId), enabled: !!org?.clientId },
  });

  const approve = useApproveContentCalendarItem({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListContentCalendarItemsQueryKey(clientId) });
        const allPublished = data.targets.every((tg) => tg.status === "published");
        toast({
          title: allPublished ? t.autopublicador.publishedToast : t.autopublicador.approvedToast,
          variant: allPublished ? "default" : "destructive",
        });
      },
      onError: (err) => toast({ title: t.autopublicador.approveErrorToast, description: String(err), variant: "destructive" }),
    },
  });

  const sorted = [...(items ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pendingCount = sorted.filter((i) => i.status === "pending_approval").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Share2 className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t.autopublicador.title}</h1>
          <p className="text-sm text-muted-foreground">{t.autopublicador.subtitle}</p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">
            {t.autopublicador.pendingCount(pendingCount)}
          </span>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 animate-pulse text-sm text-muted-foreground">{t.common.loading}</CardContent></Card>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t.autopublicador.emptyMsg}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <Card key={item.id} className={item.status === "pending_approval" ? "border-amber-400/30" : "border-border/40"}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm flex-1">{item.caption}</p>
                  <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${t.autopublicador.statusColor[item.status] ?? t.autopublicador.statusColor.draft}`}>
                    {t.autopublicador.status[item.status] ?? item.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.targets.map((target) => (
                    <span key={target.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground" title={target.failureReason ?? undefined}>
                      {target.status === "published" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        : target.status === "failed" ? <XCircle className="h-3 w-3 text-red-400" />
                        : <Clock className="h-3 w-3" />}
                      {t.autopublicador.networks[target.network] ?? target.network}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</p>
                  {item.status === "pending_approval" && (
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ clientId, id: item.id })}
                    >
                      <Check className="h-3.5 w-3.5" /> {t.autopublicador.approveAndPublish}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
