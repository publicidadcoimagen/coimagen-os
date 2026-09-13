import { useRoute } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useGetClientWorkflowStatus, getGetClientWorkflowStatusQueryKey,
} from "@workspace/api-client-react";
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

type Org = { id: number; slug: string; name: string; clientId?: number | null };

// Mirrors ALL_STAGES in artifacts/api-server/src/routes/workflows.ts — the
// 20 internal engineering stages, in order, grouped into the 10 client-
// facing stages of t.workflow.stages (each group's LAST internal stage is
// what "done" is measured against). Keep both lists in sync by hand; there's
// no shared package for this constant (same pattern as workflow-engine's own
// ALL_STAGES/STAGE_LABELS duplication).
//
// client_approval (the one point where the client is actually asked to act)
// is grouped into "QA" rather than broken out into its own 11th client
// stage: /client-approvals is already its own allowlisted, independently-
// surfaced feature for that action, and adding an 11th stage here would mean
// widening t.workflow.stages, STAGE_ICONS, and every consumer that assumes
// 10 entries for one internal label most clients won't need to distinguish
// from general QA. Reconsider if clients start asking "what stage am I in"
// specifically during an open approval.
const STAGE_GROUPS: string[][] = [
  ["lead_received"],
  ["diagnosis_started", "diagnosis_completed"],
  ["proposal_sent", "proposal_approved"],
  ["contract_sent", "contract_signed"],
  ["payment_received"],
  ["onboarding_started", "onboarding_completed"],
  ["production_started", "design_review", "development_review"],
  ["qa_internal", "changes_requested", "client_approval"],
  ["final_delivery"],
  ["monthly_active", "support_active", "customer_success"],
];

// 1-based client-facing stage index for an internal stage — matches the
// existing 1-based `currentStage` math this component already renders with.
// Unknown/legacy stage values fall back to stage 1 rather than crashing.
function toClientStageNumber(internalStage: string): number {
  const idx = STAGE_GROUPS.findIndex((group) => group.includes(internalStage));
  return idx === -1 ? 1 : idx + 1;
}

export function ClientWorkflow() {
  const [, params] = useRoute("/client/:slug/workflow");
  const slug = params?.slug ?? "";

  return (
    <ClientRoomLayout slug={slug}>
      <ClientWorkflowBody slug={slug} />
    </ClientRoomLayout>
  );
}

// useLang() must run inside LanguageProvider's subtree, which ClientRoomLayout
// mounts as a child — calling it in the exported route component (an ancestor
// of ClientRoomLayout) throws on every render (fixed 2026-08-26).
function ClientWorkflowBody({ slug }: { slug: string }) {
  const { t } = useLang();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;
  const clientId = org?.clientId ?? 0;

  const { data: workflow, isLoading, error } = useGetClientWorkflowStatus(clientId, {
    query: { queryKey: getGetClientWorkflowStatusQueryKey(clientId), enabled: !!clientId, retry: false },
  });

  const stages = t.workflow.stages.map((s, i) => ({ ...s, icon: STAGE_ICONS[i]! }));

  if (!clientId || isLoading) {
    return (
      <div className="space-y-5">
        <Card><CardContent className="p-6 animate-pulse text-sm text-muted-foreground">{t.common.loading}</CardContent></Card>
      </div>
    );
  }

  // 404 (no workflow row yet, e.g. a client whose contract hasn't produced
  // one) — show the static stage list with nothing marked done/current
  // rather than a hard error or a misleading fake progress point.
  if (error || !workflow) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.workflow.title}</h1>
            <p className="text-sm text-muted-foreground">{t.workflow.subtitle}</p>
          </div>
        </div>
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t.workflow.noWorkflow}</CardContent></Card>
      </div>
    );
  }

  const currentStage = toClientStageNumber(workflow.currentStage);
  const CurrentStageIcon = stages[currentStage - 1]?.icon ?? Factory;

  return (
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
                <CurrentStageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">{t.workflow.currentStageLabel(stages[currentStage - 1]?.name ?? "")}</p>
                <p className="text-xs text-muted-foreground">{t.workflow.stageOfTotal(currentStage, stages.length)}</p>
              </div>
              <Badge variant="outline" className="ml-auto bg-blue-400/10 text-blue-400 border-blue-400/30">
                {workflow.status === "completed" ? t.workflow.completed : t.workflow.inProgress}
              </Badge>
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
  );
}
