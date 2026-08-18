import { useRoute } from "wouter";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Construction, Sparkles, Shield, Zap, Lock } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

const CAPABILITY_ICONS = [Sparkles, Shield, Zap, Lock];

export function ClientAI() {
  const [, params] = useRoute("/client/:slug/ai");
  const slug = params?.slug ?? "";
  const { t } = useLang();
  const capabilities = t.ai.capabilities.map((label, i) => ({ label, icon: CAPABILITY_ICONS[i]! }));

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.ai.title}</h1>
            <p className="text-sm text-muted-foreground">{t.ai.subtitle}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[9px] py-0 bg-amber-400/10 text-amber-400 border-amber-400/30">{t.common.comingSoon}</Badge>
        </div>

        <div className="flex flex-col items-center justify-center py-10 gap-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Bot className="h-12 w-12 text-primary/50" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
              <Construction className="h-3.5 w-3.5 text-amber-400" />
            </div>
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-lg font-bold">{t.ai.underConstruction}</h2>
            <p className="text-sm text-muted-foreground">
              {t.ai.comingSoonDesc}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">{t.ai.plannedCapabilities}</p>
          <div className="space-y-2">
            {capabilities.map(({ icon: Icon, label }) => (
              <Card key={label} className="border-border/40">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-primary/60 flex-shrink-0" />
                  <p className="text-sm">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-primary mb-1">{t.ai.securityGuaranteed}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.ai.securityDesc}
            </p>
          </CardContent>
        </Card>
      </div>
    </ClientRoomLayout>
  );
}
