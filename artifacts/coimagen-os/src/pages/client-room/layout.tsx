import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/better-auth-web";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { LanguageProvider, useLang } from "@/context/LanguageContext";
import {
  LayoutDashboard, FolderKanban, GitBranch, CheckSquare,
  FileSignature, Receipt, FileText, Calendar, MessageSquare,
  Bot, User, ArrowLeft, Building2, ChevronRight, ClipboardCheck, KeyRound,
  ShoppingBag, LogOut, Languages,
} from "lucide-react";

type Org = {
  id: number; slug: string; name: string; description?: string | null;
  clientId?: number | null; logoUrl?: string | null; primaryColor?: string | null;
  contactEmail?: string | null;
};

type NavKey = "onboarding" | "dashboard" | "projects" | "contracts" | "invoices" | "approvals" | "catalog" | "workflow" | "documents" | "calendar" | "messages" | "ai" | "profile";

// The 6 base modules every client always sees, scoped to their own
// clientId (P-79) — order matches the spec. "" is the dashboard's own
// route (/client/:slug with no trailing segment). `key` resolves the label
// via t.nav[key] at render time — labels themselves live in LanguageContext.
const BASE_NAV_ITEMS: { sub: string; key: NavKey; icon: typeof LayoutDashboard }[] = [
  { sub: "onboarding", key: "onboarding", icon: ClipboardCheck },
  { sub: "",           key: "dashboard",  icon: LayoutDashboard },
  { sub: "projects",   key: "projects",   icon: FolderKanban },
  { sub: "contracts",  key: "contracts",  icon: FileSignature },
  { sub: "invoices",   key: "invoices",   icon: Receipt },
  { sub: "approvals",  key: "approvals",  icon: CheckSquare },
];

// Nav entries unlocked per enabledModules key (P-79). "ecommerce" now
// points at the real Becky Beck catalog (migrated off its old standalone
// staff-only page). "autopublicador" still needs a real content-calendar
// integration, not a relabeled placeholder, so it stays unwired.
const MODULE_NAV_ITEMS: Record<string, { sub: string; key: NavKey; icon: typeof LayoutDashboard }[]> = {
  ecommerce: [{ sub: "catalog", key: "catalog", icon: ShoppingBag }],
};

// Staff-only extras: scaffolded client-room pages not in the P-79 base
// list. Still useful when staff previews a client room, hidden for actual
// cliente-role logins so the nav matches the approved module matrix.
const STAFF_EXTRA_ITEMS: { sub: string; key: NavKey; icon: typeof LayoutDashboard }[] = [
  { sub: "workflow",   key: "workflow",  icon: GitBranch },
  { sub: "documents",  key: "documents", icon: FileText },
  { sub: "calendar",   key: "calendar",  icon: Calendar },
  { sub: "messages",   key: "messages",  icon: MessageSquare },
  { sub: "ai",         key: "ai",        icon: Bot },
];

const PROFILE_ITEM: { sub: string; key: NavKey; icon: typeof LayoutDashboard } = { sub: "profile", key: "profile", icon: User };

function NavItem({ href, icon: Icon, label, active }: {
  href: string; icon: React.ComponentType<{ className?: string }>; label: string; active: boolean;
}) {
  return (
    <Link href={href}>
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all group ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}>
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
        <span className="flex-1 truncate font-medium">{label}</span>
        {active && <ChevronRight className="h-3 w-3 opacity-60" />}
      </div>
    </Link>
  );
}

function ClientRoomLayoutInner({ slug, children }: { slug: string; children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const isCliente = user?.role === "cliente";
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { data: rawOrg } = useGetOrganization(slug, {
    query: { queryKey: getGetOrganizationQueryKey(slug) },
  });
  const org = rawOrg as Org | undefined;

  const base = `/client/${slug}`;

  function isActive(sub: string) {
    if (sub === "") return location === base || location === `${base}/`;
    return location.startsWith(`${base}/${sub}`);
  }

  // A cliente-role login only ever sees the approved module matrix: the 6
  // base modules + whatever their client's enabledModules unlocks, plus
  // their own profile. Staff previewing a client room still see everything,
  // including the not-yet-in-the-matrix scaffolded pages (P-79).
  const moduleItems = (user?.enabledModules ?? []).flatMap((m) => MODULE_NAV_ITEMS[m] ?? []);
  const navItems = isCliente
    ? [...BASE_NAV_ITEMS, ...moduleItems, PROFILE_ITEM]
    : [...BASE_NAV_ITEMS, ...STAFF_EXTRA_ITEMS, PROFILE_ITEM];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border/60 bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: org?.primaryColor ?? "hsl(var(--primary))" }}
            >
              {org?.name?.slice(0, 2).toUpperCase() ?? "CR"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{org?.name ?? slug}</p>
              <p className="text-[10px] text-muted-foreground">{t.common.clientRoom}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] py-0 w-full justify-center bg-primary/10 text-primary border-primary/30">
            /client/{slug}
          </Badge>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.sub}
              href={item.sub ? `${base}/${item.sub}` : base}
              icon={item.icon}
              label={t.nav[item.key]}
              active={isActive(item.sub)}
            />
          ))}
        </nav>

        {/* Language switcher — shows the OTHER language's name, tap to switch */}
        <div className="px-3 pt-2">
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setLang(lang === "es" ? "en" : "es")}
          >
            <Languages className="h-3.5 w-3.5" />
            {t.nav.switchTo}
          </Button>
        </div>

        {/* Footer — internal-OS links are staff-only, since a cliente login
            must never have a path back into the internal app (P-79). A
            cliente login gets its own account actions here instead. */}
        {!isCliente && (
        <div className="p-3 border-t border-border/60">
          <Separator className="mb-3" />
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.nav.backToOS}
            </Link>
          </Button>
          {org?.clientId && (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground mt-1" asChild>
              <Link href={`/clients/${org.clientId}`}>
                <Building2 className="h-3.5 w-3.5" />
                {t.nav.profileInOS}
              </Link>
            </Button>
          )}
        </div>
        )}
        {isCliente && (
        <div className="p-3 border-t border-border/60">
          <Separator className="mb-3" />
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link href={`${base}/profile`}>
              <Building2 className="h-3.5 w-3.5" />
              {t.nav.editCompany}
            </Link>
          </Button>
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground mt-1"
            onClick={() => setChangePasswordOpen(true)}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t.nav.changePassword}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground mt-1"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t.nav.logout}
          </Button>
        </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </main>

      {isCliente && (
        <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}

// Every client-room page renders through this — wrapping the provider here,
// rather than at App.tsx's top level, keeps the i18n scope naturally limited
// to client-room without touching the internal staff dashboard's routing.
export function ClientRoomLayout(props: { slug: string; children: ReactNode }) {
  return (
    <LanguageProvider>
      <ClientRoomLayoutInner {...props} />
    </LanguageProvider>
  );
}
