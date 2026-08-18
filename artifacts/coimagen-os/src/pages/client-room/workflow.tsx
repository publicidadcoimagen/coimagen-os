import { useRoute } from "wouter";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch, CheckCircle2, Clock, Circle,
  UserSearch, Stethoscope, FileText, DollarSign,
  Users, Factory, ShieldCheck, Package, Handshake,
} from "lucide-react";
import { useLang } from "@/context/LanguageContext";

const STAGE_ICONS = [UserSearch, Stethoscope, FileText, FileText, DollarSign, Users, Factory, ShieldCheck, Package, Handshake];

export function ClientWorkflow() {
  const [, params] = useRoute("/client/:slug/workflow");
  const slug = params?.slug ?? "";
  const { t } = useLang();
  const currentStage = 6;
  const stages = t.workflow.stages.map((s, i) => ({ ...s, icon: STAGE_ICONS[i]! }));

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.workflow.title}</h1>
            <p className="text-sm text-muted-foreground">{t.workflow.subtitle}</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-green-400/10 text-green-400 border-green-400/30 text-[10px]">{t.common.readOnly}</Badge>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">{t.workflow.currentStageLabel}</p>
                <p className="text-xs text-muted-foreground">{t.workflow.stageOfTotal(currentStage, stages.length)}</p>
              </div>
              <Badge variant="outline" className="ml-auto bg-blue-400/10 text-blue-400 border-blue-400/30">{t.workflow.inProgress}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {stages.map((stage, i) => {
            const isDone    = i < currentStage - 1;
            const isCurrent = i === currentStage - 1;
            const isPending = i > currentStage - 1;
            const Icon = stage.icon;

            return (
              <div key={stage.name} className="flex items-start gap-3">
                {/* Connector line */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 32 }}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone    ? "bg-primary border-primary" :
                    isCurrent ? "bg-primary/20 border-primary" :
                                "bg-muted border-border"
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                    ) : isCurrent ? (
                      <Clock className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </div>
                  {i < stages.length - 1 && (
                    <div className={`w-0.5 h-3 mt-1 ${isDone ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>

                {/* Content */}
                <Card className={`flex-1 mb-1 ${
                  isCurrent ? "border-primary/40 bg-primary/5 shadow-sm" :
                  isDone    ? "border-green-400/20 bg-green-400/5 opacity-70" :
                              "border-border/40 opacity-40"
                }`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${
                      isDone ? "text-green-400" : isCurrent ? "text-primary" : "text-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isPending ? "text-muted-foreground" : ""}`}>{stage.name}</p>
                        {isDone    && <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30">{t.workflow.completed}</Badge>}
                        {isCurrent && <Badge variant="outline" className="text-[9px] py-0 bg-blue-400/10 text-blue-400 border-blue-400/30">{t.workflow.inProgress}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{stage.desc}</p>
                    </div>
                    <span className={`text-[10px] font-mono flex-shrink-0 ${isPending ? "text-muted-foreground/30" : "text-muted-foreground"}`}>{i + 1}/{stages.length}</span>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </ClientRoomLayout>
  );
}
