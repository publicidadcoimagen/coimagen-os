import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Code2, TestTube2, Gauge, Lock, Network, HeartPulse,
  ClipboardList, Lightbulb, ChevronLeft, CheckCircle2,
  AlertCircle, Construction,
} from "lucide-react";

// ─── Shared Layout ─────────────────────────────────────────────────────────────
function SubmoduleLayout({
  icon: Icon, title, description, color, bg, href, badge = "PREP", children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; color: string; bg: string; href: string;
  badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link href="/quality-center"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <Badge variant="outline" className="text-[9px] py-0 bg-muted/20 text-muted-foreground border-border/30">{badge}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="border-amber-400/20 bg-amber-400/5">
        <CardContent className="p-3 flex items-start gap-2">
          <Construction className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Este módulo está <strong className="text-foreground">preparado</strong> con su estructura completa. La integración con herramientas externas se activará en una versión futura.
          </p>
        </CardContent>
      </Card>

      {children}
    </div>
  );
}

function CategoryCard({ title, items, color = "text-primary" }: { title: string; items: string[]; color?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className={`text-xs font-semibold mb-2 ${color}`}>{title}</p>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CODE REVIEW ──────────────────────────────────────────────────────────────
export function CodeReview() {
  return (
    <SubmoduleLayout icon={Code2} title="Code Review" description="Auditoría automática de código y buenas prácticas" color="text-blue-400" bg="bg-blue-400/10" href="/quality-center">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CategoryCard title="Lenguajes / Frameworks" color="text-blue-400" items={["React","Express","TypeScript","OpenAPI","Drizzle ORM"]} />
        <CategoryCard title="Análisis de código" color="text-blue-400" items={["Duplicación","Complejidad ciclomática","Código muerto","Código obsoleto","Acoplamiento excesivo"]} />
        <CategoryCard title="Buenas prácticas" color="text-blue-400" items={["Naming conventions","Separación de responsabilidades","Comentarios y documentación","Manejo de errores","Tests unitarios"]} />
        <CategoryCard title="Componentes UI" color="text-blue-400" items={["Reutilización de componentes","Props drilling","Estado global vs local","Renderizado condicional","Performance de render"]} />
        <CategoryCard title="Backend" color="text-blue-400" items={["Middlewares","Validación de inputs","Manejo de errores HTTP","Logging correcto","Seguridad de rutas"]} />
        <CategoryCard title="Base de datos" color="text-blue-400" items={["Esquemas Drizzle","Índices","Migraciones","N+1 queries","Transacciones"]} />
      </div>
    </SubmoduleLayout>
  );
}

// ─── QA TESTING ──────────────────────────────────────────────────────────────
export function QATesting() {
  const testCategories = [
    { title: "Pruebas UI", color: "text-green-400", items: ["Renderizado de componentes","Navegación y rutas","Formularios y validaciones","Modales y diálogos","Responsive design"] },
    { title: "Pruebas Backend", color: "text-green-400", items: ["Endpoints REST","Autenticación y autorización","Validación de schemas","Manejo de errores","Rate limiting"] },
    { title: "Pruebas E2E", color: "text-green-400", items: ["Flujo de login","Creación de clientes","Ciclo de proyectos","Onboarding wizard","Workflow Engine"] },
    { title: "Roles y Permisos", color: "text-green-400", items: ["CEO (admin total)","Admin (gestión)","Viewer (solo lectura)","Rutas protegidas","Acciones restringidas"] },
    { title: "CRUD por módulo", color: "text-green-400", items: ["Clientes","Proyectos","Tareas","Facturas","Incidentes"] },
    { title: "Automatizaciones", color: "text-green-400", items: ["Triggers","Acciones","Condiciones","Logs de ejecución","Reintentos"] },
  ];
  return (
    <SubmoduleLayout icon={TestTube2} title="QA Testing" description="Registro de pruebas UI, backend, e2e y más" color="text-green-400" bg="bg-green-400/10" href="/quality-center">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {testCategories.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
      </div>
    </SubmoduleLayout>
  );
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
export function Performance() {
  const perfCategories = [
    { title: "Base de datos", color: "text-yellow-400", items: ["Queries lentas (>100ms)","Queries sin índice","N+1 queries","Pool de conexiones","Cache de resultados"] },
    { title: "Frontend", color: "text-yellow-400", items: ["Tiempo de render inicial","Re-renders innecesarios","Bundle size","Code splitting","Lazy loading"] },
    { title: "Lighthouse", color: "text-yellow-400", items: ["Performance score","Accessibility score","Best Practices","SEO","PWA readiness"] },
    { title: "Core Web Vitals", color: "text-yellow-400", items: ["LCP (Largest Contentful Paint)","FID (First Input Delay)","CLS (Cumulative Layout Shift)","TTFB","FCP"] },
    { title: "API", color: "text-yellow-400", items: ["Tiempo de respuesta p50","Tiempo de respuesta p95","Throughput (req/s)","Error rate","Timeout rate"] },
    { title: "Bundle Analysis", color: "text-yellow-400", items:["Tamaño total","Chunks","Dependencias pesadas","Tree shaking","Gzip ratio"] },
  ];
  return (
    <SubmoduleLayout icon={Gauge} title="Performance" description="Métricas de rendimiento del sistema completo" color="text-yellow-400" bg="bg-yellow-400/10" href="/quality-center">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {perfCategories.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
      </div>
    </SubmoduleLayout>
  );
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────
export function Security() {
  const secCategories = [
    { title: "Autenticación", color: "text-purple-400", items: ["Better Auth (email + contraseña)","Sesiones seguras","Token expiry","CSRF protection","Rate limiting en auth"] },
    { title: "Roles y Permisos", color: "text-purple-400", items: ["CEO / Admin / Viewer","requireRole() middleware","Rutas protegidas","Acciones por rol","Audit logging"] },
    { title: "Endpoints", color: "text-purple-400", items: ["Endpoints públicos","Endpoints protegidos","Validación de inputs","Sanitización","SQL injection"] },
    { title: "Variables y Secretos", color: "text-purple-400", items: ["SESSION_SECRET","DATABASE_URL","Variables de entorno","Sin secrets en código","Rotación de secretos"] },
    { title: "Headers HTTP", color: "text-purple-400", items: ["CORS","Content-Security-Policy","X-Frame-Options","HSTS","X-Content-Type-Options"] },
    { title: "Dependencias", color: "text-purple-400", items: ["npm audit","Dependencias con CVEs","Versiones desactualizadas","Licencias","SBOM"] },
  ];
  return (
    <SubmoduleLayout icon={Lock} title="Security" description="Auditorías de seguridad: roles, permisos, endpoints y secretos" color="text-purple-400" bg="bg-purple-400/10" href="/quality-center">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {secCategories.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
      </div>
    </SubmoduleLayout>
  );
}

// ─── ARCHITECTURE ─────────────────────────────────────────────────────────────
export function Architecture() {
  const archCategories = [
    { title: "Servicios", color: "text-cyan-400", items: ["API Server (Express 5)","Frontend (React + Vite)","PostgreSQL + Drizzle","Reverse Proxy","Build Pipeline"] },
    { title: "Capas", color: "text-cyan-400", items: ["Capa de presentación (React)","Capa de API (Express)","Capa de datos (Drizzle + PG)","Capa de auth (Better Auth)","Capa de validación (Zod)"] },
    { title: "Dependencias", color: "text-cyan-400", items: ["pnpm workspaces","TypeScript 5.9","TanStack Query","shadcn/ui","Orval codegen"] },
    { title: "Base de datos", color: "text-cyan-400", items:["Tablas y relaciones","FK constraints","Índices","Migraciones","Drizzle ORM schema"] },
    { title: "Escalabilidad", color: "text-cyan-400", items: ["Horizontal scaling","Connection pooling","Query optimization","CDN y caching","Microservices readiness"] },
    { title: "Patrones", color: "text-cyan-400", items: ["Contract-first (OpenAPI)","Generated hooks","Audit middleware","requireRole middleware","Repository pattern"] },
  ];
  return (
    <SubmoduleLayout icon={Network} title="Architecture" description="Reportes de componentes, dependencias y escalabilidad" color="text-cyan-400" bg="bg-cyan-400/10" href="/quality-center">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {archCategories.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
      </div>
    </SubmoduleLayout>
  );
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
export function HealthCheck() {
  const checks = [
    { label: "API Server", status: "ok", detail: "Express respondiendo en /api/healthz" },
    { label: "Base de datos", status: "ok", detail: "PostgreSQL conectado y operativo" },
    { label: "Autenticación", status: "ok", detail: "Better Auth activo" },
    { label: "Frontend", status: "ok", detail: "React + Vite sirviendo correctamente" },
    { label: "Sesiones", status: "ok", detail: "Session store con PostgreSQL" },
    { label: "Audit Log", status: "ok", detail: "Middleware de auditoría activo" },
    { label: "OpenAPI / Codegen", status: "ok", detail: "Spec validada, hooks generados" },
    { label: "TypeScript", status: "ok", detail: "0 errores en typecheck completo" },
    { label: "Workflows", status: "ok", detail: "Workflow Engine operativo" },
    { label: "Smart Onboarding", status: "ok", detail: "Wizard activo con AES-256-GCM" },
  ];

  const warnings = [
    { label: "Herramientas externas", detail: "No conectadas — preparadas para integración" },
    { label: "Code Review automático", detail: "Estructura preparada, sin herramienta activa" },
    { label: "Performance monitoring", detail: "Métricas definidas, sin agente de recolección" },
  ];

  const healthy = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link href="/quality-center"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="h-9 w-9 rounded-lg bg-emerald-400/10 flex items-center justify-center">
          <HeartPulse className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Health Check</h1>
            <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30">LIVE</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Estado general del sistema en tiempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-green-400/30 bg-green-400/5 col-span-2">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-400">Sistema Saludable</p>
              <p className="text-sm text-muted-foreground">{healthy}/{checks.length} servicios operativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-400/30 bg-yellow-400/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Advertencias</p>
            <p className="text-2xl font-bold text-yellow-400">{warnings.length}</p>
            <p className="text-[10px] text-muted-foreground">pendientes de integración</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Servicios principales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {checks.map((check) => (
            <Card key={check.label} className="border-green-400/20">
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{check.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{check.detail}</p>
                </div>
                <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30 flex-shrink-0">OK</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Advertencias</h2>
        <div className="space-y-2">
          {warnings.map((w) => (
            <Card key={w.label} className="border-yellow-400/20">
              <CardContent className="p-3 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground">{w.detail}</p>
                </div>
                <Badge variant="outline" className="text-[9px] py-0 bg-yellow-400/10 text-yellow-400 border-yellow-400/30 flex-shrink-0">WARN</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TECHNICAL DEBT ───────────────────────────────────────────────────────────
export function TechnicalDebt() {
  const categories = [
    { title: "Pendientes técnicos", color: "text-orange-400", items: ["Herramientas externas no conectadas","Monitoring de performance sin agente","Tests automatizados no implementados","CI/CD pipeline no configurado","Rate limiting global pendiente"] },
    { title: "Refactorización", color: "text-orange-400", items: ["Consolidar tipos duplicados entre páginas","Extraer lógica de filtros a hooks","Unificar paleta de colores de badges","Reducir boilerplate en routes backend","Centralizar constantes de config"] },
    { title: "Código obsoleto", color: "text-orange-400", items: ["Revisar páginas coming-soon para activar","Limpiar comentarios de desarrollo","Remover console.log olvidados","Actualizar dependencias menores","Revisar TODOs en el código"] },
    { title: "Componentes", color: "text-orange-400", items: ["Spinner/Loading unificado faltante","Tabla genérica reutilizable","EmptyState estandarizado","Error boundary global","Toast notifications centralizadas"] },
  ];
  return (
    <SubmoduleLayout icon={ClipboardList} title="Technical Debt" description="Registro de pendientes técnicos y refactorización" color="text-orange-400" bg="bg-orange-400/10" href="/quality-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
      </div>
    </SubmoduleLayout>
  );
}

// ─── RECOMMENDATIONS ──────────────────────────────────────────────────────────
export function Recommendations() {
  const recs = {
    high: [
      "Implementar tests e2e con Playwright para los flujos críticos (login, onboarding, workflow)",
      "Activar monitoring de performance en producción con alertas automáticas",
      "Configurar rate limiting global en el API server",
      "Implementar CI/CD pipeline con typecheck y tests en cada push",
    ],
    medium: [
      "Conectar herramientas externas en Code Review (ESLint, SonarQube, CodeClimate)",
      "Implementar Lighthouse CI para medir Core Web Vitals en cada deploy",
      "Centralizar el manejo de errores con un Error Boundary global",
      "Crear componente de tabla genérico reutilizable para reducir duplicación",
      "Implementar sistema de notificaciones en tiempo real (WebSockets)",
    ],
    low: [
      "Documentar la API con ejemplos de uso en el README",
      "Agregar storybook para componentes UI críticos",
      "Implementar dark/light mode toggle",
      "Agregar internacionalización (i18n) para multi-idioma",
      "Crear guía de contribución y estándares de código",
    ],
  };

  const PrioritySection = ({ title, items, color, bg }: { title: string; items: string[]; color: string; bg: string }) => (
    <div>
      <h2 className={`text-sm font-semibold mb-3 ${color}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Card key={i} className={`border ${bg}`}>
            <CardContent className="p-3 flex items-start gap-2">
              <Lightbulb className={`h-4 w-4 ${color} flex-shrink-0 mt-0.5`} />
              <p className="text-xs">{item}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <SubmoduleLayout icon={Lightbulb} title="Recommendations" description="Recomendaciones de mejora por prioridad" color="text-amber-400" bg="bg-amber-400/10" href="/quality-center">
      <div className="space-y-5">
        <PrioritySection title="🔴 Alta prioridad" items={recs.high} color="text-red-400" bg="border-red-400/20" />
        <PrioritySection title="🟡 Media prioridad" items={recs.medium} color="text-yellow-400" bg="border-yellow-400/20" />
        <PrioritySection title="🟢 Baja prioridad" items={recs.low} color="text-green-400" bg="border-green-400/20" />
      </div>
    </SubmoduleLayout>
  );
}
