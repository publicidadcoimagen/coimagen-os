import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { useAuth, AuthProvider } from "@workspace/better-auth-web";
import { useListOrganizations, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { LoginForm } from "@/components/login-form";
import { ForcePasswordResetScreen } from "@/components/force-password-reset-screen";
import { ForgotPasswordScreen } from "@/components/forgot-password-screen";
import { ResetPasswordScreen } from "@/components/reset-password-screen";

import { Dashboard } from "@/pages/dashboard";
import { Clients } from "@/pages/clients/index";
import { ClientDetail } from "@/pages/clients/[id]";
import { Projects } from "@/pages/projects/index";
import { ProjectDetail } from "@/pages/projects/[id]";
import { Agents } from "@/pages/agents/index";
import { AgentDetail } from "@/pages/agents/[id]";
import { Tasks } from "@/pages/tasks/index";
import { Settings } from "@/pages/settings";
import NotFound from "@/pages/not-found";

import { Prospects } from "@/pages/commercial/prospects";
import { Pipeline } from "@/pages/commercial/pipeline";
import { Diagnosis } from "@/pages/commercial/diagnosis";
import { Proposals } from "@/pages/commercial/proposals";

import { Invoices } from "@/pages/finance/invoices";
import { Subscriptions } from "@/pages/finance/subscriptions";
import { PaymentCalendar } from "@/pages/finance/calendar";

import { Approvals } from "@/pages/approvals/index";
import { Revenue } from "@/pages/revenue/index";
import { Costs } from "@/pages/costs/index";
import { AuditLog } from "@/pages/audit/index";

import { AdminUsers } from "@/pages/admin/users";
import { HQ } from "@/pages/hq/index";
import { Backlog } from "@/pages/backlog/index";
import { DailySprint } from "@/pages/daily-sprint/index";
import { BeckyBeckCatalog } from "@/pages/becky-beck/index";
import { Roadmap } from "@/pages/roadmap/index";
import { Bugs } from "@/pages/bugs/index";
import { Ideas } from "@/pages/ideas/index";
import { KPIs } from "@/pages/kpis/index";
import { Automations } from "@/pages/automations/index";
import { AutomationDetail } from "@/pages/automations/[id]";
import { Organizacion } from "@/pages/org/index";
import { Mundos } from "@/pages/mundos/index";
import { MundoDetail } from "@/pages/mundos/[id]";
import { SmartOnboardingList } from "@/pages/onboarding/index";
import { SmartOnboardingWizard } from "@/pages/onboarding/[id]";
import { WorkflowEngine } from "@/pages/workflow-engine/index";
import { WorkflowDetail } from "@/pages/workflow-engine/[id]";
import { WorkflowTemplates } from "@/pages/workflow-engine/templates";
import { ContractEngine } from "@/pages/contracts/index";
import { ContractDetail } from "@/pages/contracts/[id]";
import { QualityCenter } from "@/pages/quality-center/index";
import { IncidentCenter } from "@/pages/quality-center/incidents/index";
import { IncidentDetail } from "@/pages/quality-center/incidents/[id]";
import {
  CodeReview, QATesting, Performance, Security, Architecture,
  TechnicalDebt, Recommendations,
} from "@/pages/quality-center/submodules";

// Integration Hub
import { IntegrationHub } from "@/pages/integrations/index";
import { IntegrationDetail } from "@/pages/integrations/[id]";

// AI Execution Engine
import { AiExecutionHub } from "@/pages/executions/index";
import { AiExecutionDetail } from "@/pages/executions/[id]";

// COIMAGEN CORE AI
import { CoreAIDashboard } from "@/pages/core-ai/index";
import { SocialAutopublisher } from "@/pages/social-autopublisher/index";

// Orchestration Engine
import { OrchestrationHub } from "@/pages/orchestration/index";
import { EventMonitor } from "@/pages/orchestration/events";
import { RuleEngine } from "@/pages/orchestration/rules";
import { GlobalTimeline } from "@/pages/orchestration/timeline";
import { EventCatalogPage } from "@/pages/orchestration/catalog-page";

// Client Room
import { ClientRoomAdmin } from "@/pages/client-room/admin";
import { ClientDashboard } from "@/pages/client-room/dashboard";
import { ClientOnboarding } from "@/pages/client-room/onboarding";
import { ClientProjects } from "@/pages/client-room/projects";
import { ClientWorkflow } from "@/pages/client-room/workflow";
import { ClientApprovals } from "@/pages/client-room/approvals";
import { ClientContracts } from "@/pages/client-room/contracts";
import { ClientInvoices } from "@/pages/client-room/invoices";
import { ClientDocuments } from "@/pages/client-room/documents";
import { ClientCalendar } from "@/pages/client-room/calendar";
import { ClientMessages } from "@/pages/client-room/messages";
import { ClientAI } from "@/pages/client-room/ai";
import { ClientProfile } from "@/pages/client-room/profile";

import { ComingSoon } from "@/pages/coming-soon";
import { Bot, Factory, Stethoscope, Layers, Cloud } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    // Fallback for any mutation that doesn't handle its own error: without
    // this, a failed save/create/delete anywhere in the portal was
    // completely silent (no toast, no error, button just stops loading) —
    // found via the Becky Beck "Guardar does nothing" bug. This only fires
    // when a mutation's own onError doesn't already handle it — both run,
    // this one doesn't replace anything.
    mutations: {
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
      },
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [location] = useLocation();

  // role="cliente" accounts are confined to their own /client/:slug — the
  // API already scopes this list to the caller's own client (clientScope
  // middleware, P-79), so this is just "which slug", not a second
  // permission check.
  const isCliente = isAuthenticated && user?.role === "cliente";
  const { data: ownOrgs } = useListOrganizations({
    query: { queryKey: getListOrganizationsQueryKey(), enabled: isCliente },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }

  // Public, unauthenticated routes — must be checked before the auth gate
  // below, or a signed-out visitor hitting either link never sees anything
  // but the login screen regardless of the URL.
  if (!isAuthenticated && location === "/forgot-password") {
    return <ForgotPasswordScreen />;
  }
  if (!isAuthenticated && location === "/reset-password") {
    return <ResetPasswordScreen />;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (user?.forcePasswordReset) {
    return <ForcePasswordResetScreen />;
  }

  if (isCliente) {
    if (!ownOrgs) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-muted-foreground text-sm animate-pulse">Cargando...</div>
        </div>
      );
    }
    const ownSlug = ownOrgs[0]?.slug;
    if (!ownSlug) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-2 text-center px-4">
          <p className="text-sm text-muted-foreground">Tu cuenta no tiene un cliente vinculado todavía. Contacta a tu agencia.</p>
        </div>
      );
    }
    if (!location.startsWith(`/client/${ownSlug}`)) {
      return <Redirect to={`/client/${ownSlug}`} />;
    }
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* ── Client Room — own layout, no AppLayout ─────────────────────── */}
      <Route path="/client/:slug/onboarding" component={ClientOnboarding} />
      <Route path="/client/:slug/projects"  component={ClientProjects} />
      <Route path="/client/:slug/workflow"  component={ClientWorkflow} />
      <Route path="/client/:slug/approvals" component={ClientApprovals} />
      <Route path="/client/:slug/contracts" component={ClientContracts} />
      <Route path="/client/:slug/invoices"  component={ClientInvoices} />
      <Route path="/client/:slug/documents" component={ClientDocuments} />
      <Route path="/client/:slug/calendar"  component={ClientCalendar} />
      <Route path="/client/:slug/messages"  component={ClientMessages} />
      <Route path="/client/:slug/ai"        component={ClientAI} />
      <Route path="/client/:slug/profile"   component={ClientProfile} />
      <Route path="/client/:slug"           component={ClientDashboard} />

      {/* ── All OS routes — wrapped in AppLayout ────────────────────────── */}
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/clients" component={Clients} />
            <Route path="/clients/:id" component={ClientDetail} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/agents" component={Agents} />
            <Route path="/agents/:id" component={AgentDetail} />
            <Route path="/tasks" component={Tasks} />
            <Route path="/settings" component={Settings} />

            <Route path="/commercial/prospects" component={Prospects} />
            <Route path="/commercial/pipeline" component={Pipeline} />
            <Route path="/commercial/diagnosis" component={Diagnosis} />
            <Route path="/commercial/proposals" component={Proposals} />

            <Route path="/finance/invoices" component={Invoices} />
            <Route path="/finance/subscriptions" component={Subscriptions} />
            <Route path="/finance/calendar" component={PaymentCalendar} />

            <Route path="/approvals" component={Approvals} />
            <Route path="/revenue" component={Revenue} />
            <Route path="/costs" component={Costs} />
            <Route path="/audit" component={AuditLog} />

            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/hq" component={HQ} />
            <Route path="/backlog" component={Backlog} />
            <Route path="/daily-sprint" component={DailySprint} />
            <Route path="/becky-beck" component={BeckyBeckCatalog} />
            <Route path="/roadmap" component={Roadmap} />
            <Route path="/bugs" component={Bugs} />
            <Route path="/ideas" component={Ideas} />
            <Route path="/kpis" component={KPIs} />
            <Route path="/automations/:id" component={AutomationDetail} />
            <Route path="/automations" component={Automations} />
            <Route path="/org" component={Organizacion} />
            <Route path="/mundos" component={Mundos} />
            <Route path="/mundos/:id" component={MundoDetail} />
            <Route path="/onboarding" component={SmartOnboardingList} />
            <Route path="/onboarding/:id" component={SmartOnboardingWizard} />
            <Route path="/workflow-engine" component={WorkflowEngine} />
            <Route path="/workflow-engine/templates" component={WorkflowTemplates} />
            <Route path="/workflow-engine/:id" component={WorkflowDetail} />
            <Route path="/contracts" component={ContractEngine} />
            <Route path="/contracts/:id" component={ContractDetail} />
            <Route path="/quality-center" component={QualityCenter} />
            <Route path="/quality-center/incidents" component={IncidentCenter} />
            <Route path="/quality-center/incidents/:id" component={IncidentDetail} />
            <Route path="/quality-center/code-review" component={CodeReview} />
            <Route path="/quality-center/qa-testing" component={QATesting} />
            <Route path="/quality-center/performance" component={Performance} />
            <Route path="/quality-center/security" component={Security} />
            <Route path="/quality-center/architecture" component={Architecture} />
            {/* Old hardcoded "always OK" Health Check — replaced by the real
                SystemVerificationWidget on the Dashboard (/). Redirect instead
                of a dead link, since this may still be bookmarked. */}
            <Route path="/quality-center/health-check">
              <Redirect to="/" />
            </Route>
            <Route path="/quality-center/technical-debt" component={TechnicalDebt} />
            <Route path="/quality-center/recommendations" component={Recommendations} />

            {/* Integration Hub */}
            <Route path="/integrations/:id" component={IntegrationDetail} />
            <Route path="/integrations" component={IntegrationHub} />

            {/* AI Execution Engine */}
            <Route path="/executions/:id" component={AiExecutionDetail} />
            <Route path="/executions" component={AiExecutionHub} />

            {/* COIMAGEN CORE AI */}
            <Route path="/core-ai" component={CoreAIDashboard} />
            <Route path="/social-autopublisher" component={SocialAutopublisher} />

            {/* Orchestration Engine */}
            <Route path="/orchestration/events"   component={EventMonitor} />
            <Route path="/orchestration/rules"    component={RuleEngine} />
            <Route path="/orchestration/timeline" component={GlobalTimeline} />
            <Route path="/orchestration/catalog"  component={EventCatalogPage} />
            <Route path="/orchestration"          component={OrchestrationHub} />

            {/* Client Room admin (list of orgs) — inside AppLayout */}
            <Route path="/client" component={ClientRoomAdmin} />

            <Route path="/coming-soon/ai-agents-pro">
              {() => <ComingSoon title="AI Agents Pro" description="Agentes de IA especializados con capacidades avanzadas de razonamiento, memoria y ejecución autónoma." Icon={Bot} />}
            </Route>
            <Route path="/coming-soon/factory-engine">
              {() => <ComingSoon title="Factory Engine" description="Motor de producción de contenido masivo con plantillas inteligentes y flujos automatizados." Icon={Factory} />}
            </Route>
            <Route path="/coming-soon/medical-os">
              {() => <ComingSoon title="Medical OS" description="Sistema operativo para clínicas y profesionales de la salud. Gestión de pacientes, citas y expedientes." Icon={Stethoscope} />}
            </Route>
            <Route path="/coming-soon/multi-tenant">
              {() => <ComingSoon title="Multi-tenant" description="Soporte para múltiples agencias bajo una sola plataforma con gestión centralizada." Icon={Layers} />}
            </Route>
            <Route path="/coming-soon/coimagen-cloud">
              {() => <ComingSoon title="Coimagen Cloud" description="Infraestructura cloud propia para despliegue, hosting y escalado de proyectos de clientes." Icon={Cloud} />}
            </Route>

            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthGate>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
