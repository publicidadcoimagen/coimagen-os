import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, Settings,
  UserSearch, TrendingUp, Stethoscope, FileText, Receipt,
  RefreshCw, CalendarDays, ShieldCheck, BarChart3, ScrollText,
  Lock, Bot, Bell,
} from "lucide-react";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import logoUrl from "@assets/logo-coimagen_1781919063971.png";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const CORE_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/agents", label: "Agentes IA", icon: Bot },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Comercial",
    items: [
      { href: "/commercial/prospects", label: "Prospectos", icon: UserSearch },
      { href: "/commercial/pipeline", label: "Pipeline", icon: TrendingUp },
      { href: "/commercial/diagnosis", label: "Diagnósticos", icon: Stethoscope },
      { href: "/commercial/proposals", label: "Propuestas", icon: FileText },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/finance/invoices", label: "Facturación", icon: Receipt },
      { href: "/finance/subscriptions", label: "Suscripciones", icon: RefreshCw },
      { href: "/finance/calendar", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Motores",
    items: [
      { href: "/approvals", label: "Centro de Aprobaciones", icon: ShieldCheck },
      { href: "/revenue", label: "Motor de Ingresos", icon: TrendingUp },
      { href: "/costs", label: "Motor de Costos", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/audit", label: "Bitácora", icon: ScrollText },
      { href: "/settings", label: "Configuración", icon: Settings },
    ],
  },
];

const COMING_SOON = [
  "AI Agents Pro",
  "Portal de Clientes",
  "Factory Engine",
  "Medical OS",
  "Multi-tenant",
  "Coimagen Cloud",
];

function NavLink({ href, label, icon: Icon }: NavItem) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NotificationBell() {
  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });
  const count = (summary?.pendingApprovals ?? 0) + (summary?.overdueInvoices ?? 0) + (summary?.overdueTasks ?? 0);
  return (
    <div className="relative">
      <Bell className="h-4 w-4 text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-0.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground dark">
      <aside className="w-60 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
          <img src={logoUrl} alt="Coimagen" className="h-7 w-auto mr-2.5" />
          <span className="font-bold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent">
            COIMAGEN OS
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {CORE_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-4">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          ))}
          <div className="mt-4">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Próximamente
            </p>
            {COMING_SOON.map((label) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground/30 cursor-not-allowed"
              >
                <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate text-xs">{label}</span>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs flex-shrink-0">
              CS
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">Camila Segovia</div>
              <div className="text-[10px] text-muted-foreground">CEO</div>
            </div>
            <NotificationBell />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-6 z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
