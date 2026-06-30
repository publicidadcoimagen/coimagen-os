import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetOrganization, getGetOrganizationQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, FolderKanban, GitBranch, CheckSquare,
  FileSignature, Receipt, FileText, Calendar, MessageSquare,
  Bot, User, ArrowLeft, Building2, ChevronRight,
} from "lucide-react";

type Org = {
  id: number; slug: string; name: string; description?: string | null;
  clientId?: number | null; logoUrl?: string | null; primaryColor?: string | null;
  contactEmail?: string | null;
};

const NAV_ITEMS = [
  { sub: "",           label: "Dashboard",   icon: LayoutDashboard },
  { sub: "projects",   label: "Proyectos",   icon: FolderKanban },
  { sub: "workflow",   label: "Workflow",    icon: GitBranch },
  { sub: "approvals",  label: "Aprobaciones",icon: CheckSquare },
  { sub: "contracts",  label: "Contratos",   icon: FileSignature },
  { sub: "invoices",   label: "Facturas",    icon: Receipt },
  { sub: "documents",  label: "Documentos",  icon: FileText },
  { sub: "calendar",   label: "Calendario",  icon: Calendar },
  { sub: "messages",   label: "Mensajes",    icon: MessageSquare },
  { sub: "ai",         label: "Asistente IA",icon: Bot },
  { sub: "profile",    label: "Perfil",      icon: User },
];

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

export function ClientRoomLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const [location] = useLocation();
  const { data: rawOrg } = useGetOrganization(slug, {
    query: { queryKey: getGetOrganizationQueryKey(slug) },
  });
  const org = rawOrg as Org | undefined;

  const base = `/client/${slug}`;

  function isActive(sub: string) {
    if (sub === "") return location === base || location === `${base}/`;
    return location.startsWith(`${base}/${sub}`);
  }

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
              <p className="text-[10px] text-muted-foreground">Client Room</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] py-0 w-full justify-center bg-primary/10 text-primary border-primary/30">
            /client/{slug}
          </Badge>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.sub}
              href={item.sub ? `${base}/${item.sub}` : base}
              icon={item.icon}
              label={item.label}
              active={isActive(item.sub)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/60">
          <Separator className="mb-3" />
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a COIMAGEN OS
            </Link>
          </Button>
          {org?.clientId && (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground mt-1" asChild>
              <Link href={`/clients/${org.clientId}`}>
                <Building2 className="h-3.5 w-3.5" />
                Perfil en OS
              </Link>
            </Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
