import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListContracts, getListContractsQueryKey,
  useUpdateContract,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

type Org = { id: number; slug: string; clientId?: number | null };
type Contract = {
  id: number; type: string; status: string; title: string; service?: string | null;
  amount?: number | null; currency?: string | null; signedAt?: string | null;
  expiresAt?: string | null; clientId?: number | null; createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-slate-400/15 text-slate-400 border-slate-400/30",
  sent:      "bg-blue-400/15 text-blue-400 border-blue-400/30",
  signed:    "bg-green-400/15 text-green-400 border-green-400/30",
  active:    "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  expired:   "bg-orange-400/15 text-orange-400 border-orange-400/30",
  cancelled: "bg-red-400/15 text-red-400 border-red-400/30",
};
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: Clock, sent: Clock, signed: CheckCircle2, active: CheckCircle2, expired: AlertCircle, cancelled: AlertCircle,
};

export function ClientContracts() {
  const [, params] = useRoute("/client/:slug/contracts");
  const slug = params?.slug ?? "";
  const { t, lang } = useLang();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const queryClient = useQueryClient();
  const { data: rawContracts = [], isLoading } = useListContracts(
    {},
    { query: { queryKey: getListContractsQueryKey() } },
  );

  const { mutate: signContract, isPending: isSigning, variables: signingVars } = useUpdateContract({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() }),
    },
  });

  const contracts = (rawContracts as Contract[]).filter((c) => org?.clientId ? c.clientId === org.clientId : false);

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <FileSignature className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.contracts.title}</h1>
            <p className="text-sm text-muted-foreground">{t.contracts.countLabel(contracts.length)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array(2).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
            <FileSignature className="h-10 w-10 opacity-20" />
            <p className="text-sm">{t.contracts.emptyMsg}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const label = t.contracts.status[c.status] ?? c.status;
              const color = STATUS_COLOR[c.status] ?? "";
              const Icon = STATUS_ICON[c.status] ?? Clock;
              const amountFmt = c.amount
                ? new Intl.NumberFormat(lang === "en" ? "en-US" : "es-MX", { style: "currency", currency: c.currency ?? "MXN" }).format(c.amount / 100)
                : null;
              return (
                <Card key={c.id} className="border-border/50">
                  <CardContent className="p-3 flex items-start gap-3">
                    <FileSignature className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium">{c.title}</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${color}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{t.contracts.types[c.type] ?? c.type}</span>
                        {amountFmt && <span className="text-emerald-400 font-medium">{amountFmt}</span>}
                        {c.signedAt && <span>{t.contracts.signedLabel} {new Date(c.signedAt).toLocaleDateString(lang === "en" ? "en-US" : "es-MX")}</span>}
                        {c.expiresAt && <span>{t.contracts.expiresLabel} {new Date(c.expiresAt).toLocaleDateString(lang === "en" ? "en-US" : "es-MX")}</span>}
                      </div>
                    </div>
                    {c.status === "sent" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white flex-shrink-0"
                        disabled={isSigning && signingVars?.id === c.id}
                        onClick={() => signContract({ id: c.id, data: { status: "signed" } })}
                      >
                        {isSigning && signingVars?.id === c.id ? t.contracts.signing : t.contracts.sign}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClientRoomLayout>
  );
}
