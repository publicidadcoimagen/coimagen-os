import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListClientApprovals, getListClientApprovalsQueryKey,
  useListInvoices, getListInvoicesQueryKey,
  useListContracts, getListContractsQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Receipt,
  Clock, TrendingUp, AlertCircle, ChevronRight, FileSignature,
} from "lucide-react";
import { Link } from "wouter";
import { useLang } from "@/context/LanguageContext";

type Org = { id: number; slug: string; name: string; clientId?: number | null; description?: string | null };
type Approval = { id: number; type: string; title: string; status: string; createdAt: string };
type Invoice = { id: number; amount: number; status: string; dueDate?: string | null };
type ContractRow = { id: number; title: string; status: string };

const WORKFLOW_STAGE_COUNT = 10;

function StageProgress({ current = 6 }: { current?: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: WORKFLOW_STAGE_COUNT }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex items-center justify-center rounded-full text-[9px] font-bold w-5 h-5 flex-shrink-0 ${
            i < current
              ? "bg-primary text-primary-foreground"
              : i === current
              ? "bg-primary/30 text-primary border border-primary"
              : "bg-muted text-muted-foreground"
          }`}>{i + 1}</div>
          {i < WORKFLOW_STAGE_COUNT - 1 && (
            <div className={`h-0.5 w-3 flex-shrink-0 ${i < current ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ClientDashboard() {
  const [, params] = useRoute("/client/:slug");
  const slug = params?.slug ?? "";

  return (
    <ClientRoomLayout slug={slug}>
      <ClientDashboardBody slug={slug} />
    </ClientRoomLayout>
  );
}

// useLang() must run inside LanguageProvider's subtree — which ClientRoomLayout
// mounts as a *child* of ClientDashboard, not an ancestor. Calling it directly
// in ClientDashboard's own body throws "useLang must be used within
// LanguageProvider" on every render, for every org (fixed 2026-08-26).
function ClientDashboardBody({ slug }: { slug: string }) {
  const { t, lang } = useLang();

  const { data: rawOrg } = useGetOrganization(slug, {
    query: { queryKey: getGetOrganizationQueryKey(slug), enabled: !!slug },
  });
  const { data: rawApprovals = [] } = useListClientApprovals(
    {},
    { query: { queryKey: getListClientApprovalsQueryKey({}) } },
  );
  const { data: rawInvoices = [] } = useListInvoices(
    {},
    { query: { queryKey: getListInvoicesQueryKey({}) } },
  );
  const { data: rawContracts = [] } = useListContracts(
    {},
    { query: { queryKey: getListContractsQueryKey() } },
  );

  const org = rawOrg as Org | undefined;
  const pendingApprovals = (rawApprovals as Approval[]).filter((a) => a.status === "pending");
  const unsignedContracts = (rawContracts as ContractRow[]).filter((c) => c.status === "sent");
  const pendingInvoices = (rawInvoices as Invoice[])
    .filter((i) => i.status === "sent" || i.status === "draft")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const nextDue = pendingInvoices.find((i) => i.dueDate)?.dueDate;

  const kpiCards = [
    { label: t.dashboard.kpiPendingApprovals, value: pendingApprovals.length, icon: CheckSquare, color: "text-orange-400", href: `/client/${slug}/approvals` },
    { label: t.dashboard.kpiProjectStatus, value: t.dashboard.inProduction, icon: TrendingUp, color: "text-green-400", href: `/client/${slug}/projects` },
    { label: t.dashboard.kpiNextPayment, value: nextDue ? new Date(nextDue).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { day: "2-digit", month: "short" }) : "—", icon: Clock, color: "text-blue-400", href: `/client/${slug}/invoices` },
    { label: t.dashboard.kpiPendingInvoices, value: pendingInvoices.length, icon: Receipt, color: "text-yellow-400", href: `/client/${slug}/invoices` },
  ];

  return (
      <div className="space-y-6">
        {/* Welcome */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t.dashboard.welcome}{org?.name ? `, ${org.name}` : ""}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {org?.description ?? t.dashboard.defaultDescription}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(({ label, value, icon: Icon, color, href }) => (
            <Link key={label} href={href}>
              <Card className="border-border/50 hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <div className="flex items-end justify-between mt-1">
                    <p className={`${typeof value === "number" ? "text-2xl" : "text-base"} font-bold`}>{value}</p>
                    <Icon className={`h-5 w-5 ${color} opacity-40`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Workflow progress */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">{t.dashboard.workflowStatus}</p>
              <Badge variant="outline" className="text-[10px] py-0 bg-green-400/10 text-green-400 border-green-400/30">{t.dashboard.inProduction}</Badge>
            </div>
            <StageProgress current={6} />
            <p className="text-[11px] text-muted-foreground mt-2">{t.dashboard.currentStagePrefix} <strong>{t.dashboard.production}</strong> — {t.dashboard.inProcess}</p>
          </CardContent>
        </Card>

        {/* Tareas pendientes de su parte — contratos sin firmar */}
        {unsignedContracts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileSignature className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-semibold">{t.dashboard.contractsToSign}</h2>
              <Badge variant="outline" className="text-[9px] py-0 bg-orange-400/10 text-orange-400 border-orange-400/30">{unsignedContracts.length}</Badge>
            </div>
            <div className="space-y-2">
              {unsignedContracts.map((c) => (
                <Card key={c.id} className="border-orange-400/20 bg-orange-400/5">
                  <CardContent className="p-3 flex items-center gap-3">
                    <FileSignature className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    <p className="text-sm font-medium flex-1">{c.title}</p>
                    <Button size="sm" className="h-7 text-xs" asChild>
                      <Link href={`/client/${slug}/contracts`}>{t.dashboard.sign}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending approvals */}
        {pendingApprovals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold">{t.dashboard.pendingApprovalsHeading}</h2>
                <Badge variant="outline" className="text-[9px] py-0 bg-orange-400/10 text-orange-400 border-orange-400/30">{pendingApprovals.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href={`/client/${slug}/approvals`}>{t.dashboard.viewAll} <ChevronRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {pendingApprovals.slice(0, 3).map((a) => (
                <Card key={a.id} className="border-orange-400/20 bg-orange-400/5">
                  <CardContent className="p-3 flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{a.type} · {new Date(a.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "es-MX")}</p>
                    </div>
                    <Button size="sm" className="h-7 text-xs" asChild>
                      <Link href={`/client/${slug}/approvals`}>{t.dashboard.review}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">{t.dashboard.quickAccess}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { href: `/client/${slug}/projects`, label: t.dashboard.viewProjects, icon: FolderKanban },
              { href: `/client/${slug}/approvals`, label: t.nav.approvals, icon: CheckSquare },
              { href: `/client/${slug}/invoices`, label: t.dashboard.myInvoices, icon: Receipt },
            ].map(({ href, label, icon: Icon }) => (
              <Button key={href} variant="outline" size="sm" className="h-9 text-xs justify-start gap-2" asChild>
                <Link href={href}><Icon className="h-3.5 w-3.5" />{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
  );
}
