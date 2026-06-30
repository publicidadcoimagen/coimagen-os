import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListContracts, getListContractsQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSignature, CheckCircle2, Clock, AlertCircle } from "lucide-react";

type Org = { id: number; slug: string; clientId?: number | null };
type Contract = {
  id: number; type: string; status: string; title: string; service?: string | null;
  amount?: number | null; currency?: string | null; signedAt?: string | null;
  expiresAt?: string | null; clientId?: number | null; createdAt: string;
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  desarrollo_web:"Desarrollo Web", seo:"SEO", google_business:"Google Business",
  automatizacion_ia:"Automatización IA", coimagen_os:"COIMAGEN OS", medical_os:"Medical OS",
  mensualidad:"Mensualidad", nda:"NDA", addendum:"Addendum", renovacion:"Renovación",
  carta_aprobacion_visual:"Carta de Aprobación", carta_entrega_final:"Carta de Entrega",
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  draft:     { label:"Borrador",   color:"bg-slate-400/15 text-slate-400 border-slate-400/30",   icon: Clock },
  sent:      { label:"Enviado",    color:"bg-blue-400/15 text-blue-400 border-blue-400/30",       icon: Clock },
  signed:    { label:"Firmado",    color:"bg-green-400/15 text-green-400 border-green-400/30",    icon: CheckCircle2 },
  active:    { label:"Activo",     color:"bg-emerald-400/15 text-emerald-400 border-emerald-400/30", icon: CheckCircle2 },
  expired:   { label:"Vencido",    color:"bg-orange-400/15 text-orange-400 border-orange-400/30",  icon: AlertCircle },
  cancelled: { label:"Cancelado",  color:"bg-red-400/15 text-red-400 border-red-400/30",          icon: AlertCircle },
};

export function ClientContracts() {
  const [, params] = useRoute("/client/:slug/contracts");
  const slug = params?.slug ?? "";

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: rawContracts = [], isLoading } = useListContracts(
    {},
    { query: { queryKey: getListContractsQueryKey() } },
  );

  const contracts = (rawContracts as Contract[]).filter((c) => org?.clientId ? c.clientId === org.clientId : false);

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <FileSignature className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Contratos</h1>
            <p className="text-sm text-muted-foreground">{contracts.length} contrato{contracts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array(2).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-16" /></Card>)}</div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
            <FileSignature className="h-10 w-10 opacity-20" />
            <p className="text-sm">No hay contratos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const meta = STATUS_META[c.status] ?? { label: c.status, color: "", icon: Clock };
              const Icon = meta.icon;
              const amountFmt = c.amount
                ? new Intl.NumberFormat("es-MX", { style: "currency", currency: c.currency ?? "MXN" }).format(c.amount / 100)
                : null;
              return (
                <Card key={c.id} className="border-border/50">
                  <CardContent className="p-3 flex items-start gap-3">
                    <FileSignature className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium">{c.title}</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${meta.color}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{meta.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</span>
                        {amountFmt && <span className="text-emerald-400 font-medium">{amountFmt}</span>}
                        {c.signedAt && <span>Firmado: {new Date(c.signedAt).toLocaleDateString("es-MX")}</span>}
                        {c.expiresAt && <span>Vence: {new Date(c.expiresAt).toLocaleDateString("es-MX")}</span>}
                      </div>
                    </div>
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
