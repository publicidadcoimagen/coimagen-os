import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListInvoices, getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

type Org = { id: number; slug: string; clientId?: number | null };
type Invoice = {
  id: number; number: string; amount: number; status: string;
  issuedDate?: string | null; dueDate?: string | null;
  description?: string | null; clientId?: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  sent: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  paid: "bg-green-400/15 text-green-400 border-green-400/30",
  overdue: "bg-red-400/15 text-red-400 border-red-400/30",
  cancelled: "bg-slate-400/15 text-slate-400 border-slate-400/30",
};
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: Clock, sent: Clock, paid: CheckCircle2, overdue: AlertCircle, cancelled: AlertCircle,
};

export function ClientInvoices() {
  const [, params] = useRoute("/client/:slug/invoices");
  const slug = params?.slug ?? "";

  return (
    <ClientRoomLayout slug={slug}>
      <ClientInvoicesBody slug={slug} />
    </ClientRoomLayout>
  );
}

// useLang() must run inside LanguageProvider's subtree, which ClientRoomLayout
// mounts as a child — calling it in the exported route component (an ancestor
// of ClientRoomLayout) throws on every render (fixed 2026-08-26).
function ClientInvoicesBody({ slug }: { slug: string }) {
  const { t } = useLang();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: rawInvoices = [], isLoading } = useListInvoices(
    {},
    { query: { queryKey: getListInvoicesQueryKey({}) } },
  );

  const invoices = (rawInvoices as Invoice[]).filter((inv) => org?.clientId ? inv.clientId === org.clientId : false);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + (i.amount ?? 0), 0);
  const totalPending = invoices.filter((i) => i.status === "sent" || i.status === "draft").reduce((acc, i) => acc + (i.amount ?? 0), 0);

  return (
    <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.invoices.title}</h1>
            <p className="text-sm text-muted-foreground">{t.invoices.countLabel(invoices.length)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.invoices.totalPaid, value: `$${totalPaid.toFixed(2)}`, icon: CheckCircle2, color: "text-green-400" },
            { label: t.invoices.pendingAmount, value: `$${totalPending.toFixed(2)}`, icon: Clock, color: "text-orange-400" },
            { label: t.invoices.totalInvoices, value: invoices.length, icon: TrendingUp, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-lg font-bold">{value}</p>
                <Icon className={`h-5 w-5 ${color} opacity-40`} />
              </div>
            </CardContent></Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-14" /></Card>)}</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
            <Receipt className="h-10 w-10 opacity-20" />
            <p className="text-sm">{t.invoices.emptyMsg}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const label = t.invoices.status[inv.status] ?? inv.status;
              const color = STATUS_COLOR[inv.status] ?? "";
              const Icon = STATUS_ICON[inv.status] ?? Clock;
              return (
                <Card key={inv.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-medium">{t.invoices.invoiceNumber}{inv.number}</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${color}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">${(inv.amount ?? 0).toFixed(2)} MXN</span>
                        {inv.issuedDate && <span>{t.invoices.issuedLabel} {inv.issuedDate}</span>}
                        {inv.dueDate && <span className={new Date(inv.dueDate) < new Date() && inv.status !== "paid" ? "text-red-400" : ""}>{t.invoices.dueLabel} {inv.dueDate}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );
}
