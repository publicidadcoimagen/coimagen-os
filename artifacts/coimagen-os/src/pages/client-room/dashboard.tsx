import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListClientApprovals, getListClientApprovalsQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Receipt,
  Clock, TrendingUp, AlertCircle, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

type Org = { id: number; slug: string; name: string; clientId?: number | null; description?: string | null };
type Approval = { id: number; type: string; title: string; status: string; createdAt: string };

const WORKFLOW_STAGES = [
  "Lead", "Diagnóstico", "Propuesta", "Contrato",
  "Pago", "Onboarding", "Producción", "QA", "Entrega", "Customer Success",
];

function StageProgress({ current = 6 }: { current?: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {WORKFLOW_STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <div className={`flex items-center justify-center rounded-full text-[9px] font-bold w-5 h-5 flex-shrink-0 ${
            i < current
              ? "bg-primary text-primary-foreground"
              : i === current
              ? "bg-primary/30 text-primary border border-primary"
              : "bg-muted text-muted-foreground"
          }`}>{i + 1}</div>
          {i < WORKFLOW_STAGES.length - 1 && (
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

  const { data: rawOrg } = useGetOrganization(slug, {
    query: { queryKey: getGetOrganizationQueryKey(slug), enabled: !!slug },
  });
  const { data: rawApprovals = [] } = useListClientApprovals(
    {},
    { query: { queryKey: getListClientApprovalsQueryKey({}) } },
  );

  const org = rawOrg as Org | undefined;
  const pendingApprovals = (rawApprovals as Approval[]).filter((a) => a.status === "pending");

  const kpiCards = [
    { label: "Aprobaciones pendientes", value: pendingApprovals.length, icon: CheckSquare, color: "text-orange-400", href: `/client/${slug}/approvals` },
    { label: "Estado del proyecto", value: "En producción", icon: TrendingUp, color: "text-green-400", href: `/client/${slug}/projects` },
    { label: "Próxima entrega", value: "—", icon: Clock, color: "text-blue-400", href: `/client/${slug}/calendar` },
    { label: "Facturas pendientes", value: "—", icon: Receipt, color: "text-yellow-400", href: `/client/${slug}/invoices` },
  ];

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Bienvenido{org?.name ? `, ${org.name}` : ""}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {org?.description ?? "Este es tu portal privado. Aquí puedes ver el estado de tu proyecto, aprobar documentos y revisar facturas."}
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
              <p className="text-sm font-semibold">Estado del Workflow</p>
              <Badge variant="outline" className="text-[10px] py-0 bg-green-400/10 text-green-400 border-green-400/30">En producción</Badge>
            </div>
            <StageProgress current={6} />
            <p className="text-[11px] text-muted-foreground mt-2">Etapa actual: <strong>Producción</strong> — En proceso</p>
          </CardContent>
        </Card>

        {/* Pending approvals */}
        {pendingApprovals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold">Aprobaciones pendientes</h2>
                <Badge variant="outline" className="text-[9px] py-0 bg-orange-400/10 text-orange-400 border-orange-400/30">{pendingApprovals.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href={`/client/${slug}/approvals`}>Ver todas <ChevronRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {pendingApprovals.slice(0, 3).map((a) => (
                <Card key={a.id} className="border-orange-400/20 bg-orange-400/5">
                  <CardContent className="p-3 flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{a.type} · {new Date(a.createdAt).toLocaleDateString("es-MX")}</p>
                    </div>
                    <Button size="sm" className="h-7 text-xs" asChild>
                      <Link href={`/client/${slug}/approvals`}>Revisar</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { href: `/client/${slug}/projects`, label: "Ver proyectos", icon: FolderKanban },
              { href: `/client/${slug}/approvals`, label: "Aprobaciones", icon: CheckSquare },
              { href: `/client/${slug}/invoices`, label: "Mis facturas", icon: Receipt },
            ].map(({ href, label, icon: Icon }) => (
              <Button key={href} variant="outline" size="sm" className="h-9 text-xs justify-start gap-2" asChild>
                <Link href={href}><Icon className="h-3.5 w-3.5" />{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ClientRoomLayout>
  );
}
