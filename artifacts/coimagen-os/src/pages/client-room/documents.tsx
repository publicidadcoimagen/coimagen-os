import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useListContracts, getListContractsQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSignature, ExternalLink } from "lucide-react";

type Org = { id: number; slug: string; clientId?: number | null };
type Contract = {
  id: number; type: string; status: string; title: string;
  clientId?: number | null; signedAt?: string | null; createdAt: string;
};

const DOC_TYPES = ["nda", "addendum", "renovacion", "carta_aprobacion_visual", "carta_entrega_final", "desarrollo_web", "seo", "google_business", "automatizacion_ia", "coimagen_os", "medical_os", "mensualidad"];

const TYPE_LABEL: Record<string, string> = {
  nda:"NDA", addendum:"Addendum", renovacion:"Renovación",
  carta_aprobacion_visual:"Carta de Aprobación Visual", carta_entrega_final:"Carta de Entrega Final",
  desarrollo_web:"Contrato Desarrollo Web", seo:"Contrato SEO",
  google_business:"Contrato Google Business", automatizacion_ia:"Contrato Automatización IA",
  coimagen_os:"Contrato COIMAGEN OS", medical_os:"Contrato Medical OS", mensualidad:"Contrato Mensualidad",
};

export function ClientDocuments() {
  const [, params] = useRoute("/client/:slug/documents");
  const slug = params?.slug ?? "";

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: rawContracts = [], isLoading } = useListContracts(
    {},
    { query: { queryKey: getListContractsQueryKey() } },
  );

  const docs = (rawContracts as Contract[]).filter((c) =>
    org?.clientId ? c.clientId === org.clientId : false,
  );

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Documentos</h1>
            <p className="text-sm text-muted-foreground">Contratos, NDAs y material entregado</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contratos y acuerdos</p>
          {isLoading ? (
            Array(2).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-12" /></Card>)
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/50 rounded-xl gap-3 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-20" />
              <p className="text-sm">No hay documentos disponibles</p>
            </div>
          ) : (
            docs.map((doc) => (
              <Card key={doc.id} className="border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-3 flex items-center gap-3">
                  <FileSignature className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[doc.type] ?? doc.type}</span>
                      {doc.signedAt && <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30">Firmado</Badge>}
                      <span className="text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString("es-MX")}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] py-0 flex-shrink-0 gap-1 cursor-not-allowed opacity-50">
                    <ExternalLink className="h-2.5 w-2.5" />PDF (próximamente)
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/30 bg-muted/5">
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Google Drive</p>
              <p className="text-[10px] text-muted-foreground">La integración con Drive estará disponible próximamente para compartir presentaciones, briefs y material entregado.</p>
            </div>
            <Badge variant="outline" className="text-[9px] py-0 flex-shrink-0">Próximamente</Badge>
          </CardContent>
        </Card>
      </div>
    </ClientRoomLayout>
  );
}
