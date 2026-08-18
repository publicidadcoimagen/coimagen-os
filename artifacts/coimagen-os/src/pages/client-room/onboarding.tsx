import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useGetClientOnboarding, getGetClientOnboardingQueryKey,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, CheckCircle2, Circle } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

type Org = { id: number; slug: string; name: string; clientId?: number | null };

type ChecklistKey = "hasLogo" | "hasBrandColors" | "hasBusinessInfo" | "hasWebsiteAccess" | "hasDomainAccess" | "hasHostingAccess" | "hasFacebookAccess" | "hasInstagramAccess" | "hasGoogleBusinessAccess" | "hasWhatsappAccess";

const CHECKLIST_KEYS: ChecklistKey[] = [
  "hasLogo", "hasBrandColors", "hasBusinessInfo", "hasWebsiteAccess", "hasDomainAccess",
  "hasHostingAccess", "hasFacebookAccess", "hasInstagramAccess", "hasGoogleBusinessAccess", "hasWhatsappAccess",
];

export function ClientOnboarding() {
  const [, params] = useRoute("/client/:slug/onboarding");
  const slug = params?.slug ?? "";
  const { t } = useLang();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  const { data: onboarding, isLoading } = useGetClientOnboarding(org?.clientId ?? 0, {
    query: { queryKey: getGetClientOnboardingQueryKey(org?.clientId ?? 0), enabled: !!org?.clientId },
  });

  const done = onboarding ? CHECKLIST_KEYS.filter((k) => onboarding[k]).length : 0;

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.onboarding.title}</h1>
            <p className="text-sm text-muted-foreground">{t.onboarding.subtitle}</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-green-400/10 text-green-400 border-green-400/30 text-[10px]">{t.common.readOnly}</Badge>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 animate-pulse text-sm text-muted-foreground">{t.common.loading}</CardContent></Card>
        ) : !onboarding ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            {t.onboarding.notStarted}
          </CardContent></Card>
        ) : (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">{t.onboarding.completedText(done, CHECKLIST_KEYS.length)}</p>
                  <p className="text-xs text-muted-foreground">{t.onboarding.agencyTracking}</p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {CHECKLIST_KEYS.map((key) => {
                const isDone = !!onboarding[key];
                return (
                  <Card key={key} className={isDone ? "border-green-400/20 bg-green-400/5" : "border-border/40"}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <p className={`text-sm ${isDone ? "" : "text-muted-foreground"}`}>{t.onboarding.checklist[key]}</p>
                      <Badge variant="outline" className={`ml-auto text-[10px] py-0 ${isDone ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-orange-400/10 text-orange-400 border-orange-400/30"}`}>
                        {isDone ? t.onboarding.received : t.onboarding.pending}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {onboarding.notes && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t.onboarding.notesFromAgency}</p>
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
