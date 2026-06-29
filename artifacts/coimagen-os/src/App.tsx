import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";

import { Dashboard } from "@/pages/dashboard";
import { Clients } from "@/pages/clients/index";
import { ClientDetail } from "@/pages/clients/[id]";
import { Projects } from "@/pages/projects/index";
import { ProjectDetail } from "@/pages/projects/[id]";
import { Agents } from "@/pages/agents/index";
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

import { ComingSoon } from "@/pages/coming-soon";
import { Bot, Users, Factory, Stethoscope, Layers, Cloud } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">COIMAGEN OS</h1>
          <p className="text-muted-foreground text-sm">Sistema Operativo Interno</p>
        </div>
        <Button onClick={login} size="lg">
          Iniciar sesión con Replit
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/agents" component={Agents} />
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

        <Route path="/coming-soon/ai-agents-pro">
          {() => <ComingSoon title="AI Agents Pro" description="Agentes de IA especializados con capacidades avanzadas de razonamiento, memoria y ejecución autónoma." Icon={Bot} />}
        </Route>
        <Route path="/coming-soon/portal-clientes">
          {() => <ComingSoon title="Portal de Clientes" description="Portal autoservicio para que tus clientes vean proyectos, facturas y aprobaciones en tiempo real." Icon={Users} />}
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
