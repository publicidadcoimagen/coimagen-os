import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useGetClientOnboarding, getGetClientOnboardingQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, CheckCircle2, Circle } from "lucide-react";

type Org = { id: number; slug: string; name: string; clientId?: number | null };

const CHECKLIST: { key: "hasLogo" | "hasBrandColors" | "hasBusinessInfo" | "hasWebsiteAccess" | "hasDomainAccess" | "hasHostingAccess" | "hasFacebookAccess" | "hasInstagramAccess" | "hasGoogleBusinessAccess" | "hasWhatsappAccess"; label: string }[] = [
  { key: "hasLogo",               label: "Logo en alta resolución" },
  { key: "hasBrandColors",        label: "Colores y guía de marca" },
  { key: "hasBusinessInfo",       label: "Información del negocio" },
  { key: "hasWebsiteAccess",      label: "Acceso al sitio web" },
  { key: "hasDomainAccess",       label: "Acceso al dominio" },
  { key: "hasHostingAccess",      label: "Acceso al hosting" },
  { key: "hasFacebookAccess",     label: "Acceso a Facebook" },
  { key: "hasInstagramAccess",    label: "Acceso a Instagram" },
  { key: "hasGoogleBusinessAccess", label: "Acceso a Google Business" },
  { key: "hasWhatsappAccess",     label: "Acceso a WhatsApp Business" },
];

export function ClientOnboarding() {
  const [, params] = useRoute("/client/:slug/onboarding");
  const slug = params?.slug ?? "";

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: onboarding, isLoading } = useGetClientOnboarding(org?.clientId ?? 0, {
    query: { queryKey: getGetClientOnboardingQueryKey(org?.clientId ?? 0), enabled: !!org?.clientId },
  });

  const done = onboarding ? CHECKLIST.filter((c) => onboarding[c.key]).length : 0;

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Onboarding</h1>
            <p className="text-sm text-muted-foreground">Accesos e información que tu agencia necesita para arrancar</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-green-400/10 text-green-400 border-green-400/30 text-[10px]">Solo lectura</Badge>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 animate-pulse text-sm text-muted-foreground">Cargando...</CardContent></Card>
        ) : !onboarding ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Tu agencia todavía no inició el checklist de onboarding para tu cuenta.
          </CardContent></Card>
        ) : (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">{done} de {CHECKLIST.length} completados</p>
                  <p className="text-xs text-muted-foreground">Tu agencia va marcando cada punto conforme lo recibe</p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {CHECKLIST.map((item) => {
                const isDone = !!onboarding[item.key];
                return (
                  <Card key={item.key} className={isDone ? "border-green-400/20 bg-green-400/5" : "border-border/40"}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <p className={`text-sm ${isDone ? "" : "text-muted-foreground"}`}>{item.label}</p>
                      <Badge variant="outline" className={`ml-auto text-[10px] py-0 ${isDone ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-orange-400/10 text-orange-400 border-orange-400/30"}`}>
                        {isDone ? "Recibido" : "Pendiente"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {onboarding.notes && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Notas de tu agencia</p>
                  <p className="text-sm">{onboarding.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ClientRoomLayout>
  );
}
