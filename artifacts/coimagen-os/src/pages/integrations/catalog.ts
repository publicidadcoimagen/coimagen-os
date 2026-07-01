export type IntegrationTemplate = {
  name: string;
  platform: string;
  description: string;
  type: string;
  credentialsRequired: string[];
  envVars: string[];
};

export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    name: "Gmail",
    platform: "Google",
    description: "Envío de emails, notificaciones automáticas y seguimientos comerciales desde COIMAGEN OS.",
    type: "email",
    credentialsRequired: ["OAuth 2.0 Client ID", "OAuth 2.0 Client Secret", "Refresh Token"],
    envVars: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"],
  },
  {
    name: "Google Calendar",
    platform: "Google",
    description: "Sincronización de reuniones, vencimientos y eventos del sistema con Google Calendar.",
    type: "calendar",
    credentialsRequired: ["OAuth 2.0 Client ID", "OAuth 2.0 Client Secret", "Calendar ID"],
    envVars: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_ID"],
  },
  {
    name: "Google Drive",
    platform: "Google",
    description: "Almacenamiento y acceso a contratos, documentos y entregables del cliente.",
    type: "files",
    credentialsRequired: ["Service Account JSON", "Drive Folder ID"],
    envVars: ["GOOGLE_DRIVE_SERVICE_ACCOUNT", "GOOGLE_DRIVE_FOLDER_ID"],
  },
  {
    name: "Jotform",
    platform: "Jotform",
    description: "Recepción de formularios de contacto, leads y solicitudes de diagnóstico.",
    type: "forms",
    credentialsRequired: ["API Key"],
    envVars: ["JOTFORM_API_KEY"],
  },
  {
    name: "Google Analytics",
    platform: "Google",
    description: "Métricas de tráfico, comportamiento y conversiones de los proyectos digitales.",
    type: "analytics",
    credentialsRequired: ["Measurement ID", "API Secret", "Property ID"],
    envVars: ["GA_MEASUREMENT_ID", "GA_API_SECRET", "GA_PROPERTY_ID"],
  },
  {
    name: "Google Search Console",
    platform: "Google",
    description: "Monitoreo de posicionamiento SEO, errores de indexación y rendimiento de búsqueda.",
    type: "seo",
    credentialsRequired: ["Service Account JSON", "Site URL"],
    envVars: ["GSC_SERVICE_ACCOUNT", "GSC_SITE_URL"],
  },
  {
    name: "Google Business Profile",
    platform: "Google",
    description: "Gestión de reseñas, publicaciones y métricas del perfil de negocio en Google.",
    type: "seo",
    credentialsRequired: ["OAuth 2.0 Client ID", "OAuth 2.0 Client Secret", "Account ID"],
    envVars: ["GBP_CLIENT_ID", "GBP_CLIENT_SECRET", "GBP_ACCOUNT_ID"],
  },
  {
    name: "WhatsApp Business",
    platform: "Meta",
    description: "Notificaciones, mensajes automatizados y seguimiento de clientes vía WhatsApp.",
    type: "messaging",
    credentialsRequired: ["Business Account ID", "Phone Number ID", "Access Token"],
    envVars: ["WHATSAPP_BUSINESS_ID", "WHATSAPP_PHONE_ID", "WHATSAPP_TOKEN"],
  },
  {
    name: "n8n",
    platform: "n8n",
    description: "Motor de automatización de workflows sin código. Conecta COIMAGEN OS con cualquier servicio externo.",
    type: "automation",
    credentialsRequired: ["Instance URL", "API Key"],
    envVars: ["N8N_URL", "N8N_API_KEY"],
  },
  {
    name: "Replit",
    platform: "Replit",
    description: "Despliegue y gestión de proyectos de desarrollo en Replit desde COIMAGEN OS.",
    type: "development",
    credentialsRequired: ["API Token", "Team ID"],
    envVars: ["REPLIT_API_TOKEN", "REPLIT_TEAM_ID"],
  },
  {
    name: "GitHub",
    platform: "GitHub",
    description: "Gestión de repositorios, issues, pull requests y despliegues automatizados.",
    type: "development",
    credentialsRequired: ["Personal Access Token", "Organization Name"],
    envVars: ["GITHUB_TOKEN", "GITHUB_ORG"],
  },
  {
    name: "Stripe",
    platform: "Stripe",
    description: "Procesamiento de pagos, suscripciones y facturación automatizada.",
    type: "payments",
    credentialsRequired: ["Secret Key", "Publishable Key", "Webhook Secret"],
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    name: "IONOS",
    platform: "IONOS",
    description: "Gestión de dominios, hosting y DNS para proyectos de clientes.",
    type: "domains",
    credentialsRequired: ["API Key", "API Secret"],
    envVars: ["IONOS_API_KEY", "IONOS_API_SECRET"],
  },
];

export const INTEGRATION_TYPES: Record<string, { label: string; color: string }> = {
  email:       { label: "Email",          color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  calendar:    { label: "Calendario",     color: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" },
  files:       { label: "Archivos",       color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  forms:       { label: "Formularios",    color: "bg-purple-400/15 text-purple-400 border-purple-400/30" },
  analytics:   { label: "Analytics",     color: "bg-green-400/15 text-green-400 border-green-400/30" },
  seo:         { label: "SEO",            color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
  messaging:   { label: "Mensajería",    color: "bg-lime-400/15 text-lime-400 border-lime-400/30" },
  automation:  { label: "Automatización",color: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  development: { label: "Desarrollo",    color: "bg-violet-400/15 text-violet-400 border-violet-400/30" },
  payments:    { label: "Pagos",          color: "bg-pink-400/15 text-pink-400 border-pink-400/30" },
  domains:     { label: "Dominios",      color: "bg-indigo-400/15 text-indigo-400 border-indigo-400/30" },
};

export const INTEGRATION_STATUSES: Record<string, { label: string; color: string }> = {
  not_configured: { label: "No configurada",      color: "bg-muted/20 text-muted-foreground border-muted/30" },
  configured:     { label: "Configurada",         color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  active:         { label: "Activa",              color: "bg-green-400/15 text-green-400 border-green-400/30" },
  paused:         { label: "Pausada",             color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  error:          { label: "Error",               color: "bg-red-400/15 text-red-400 border-red-400/30" },
  attention:      { label: "Requiere atención",   color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
};

export const LOG_ACTION_LABELS: Record<string, string> = {
  configured: "Configurada",
  activated:  "Activada",
  paused:     "Pausada",
  error:      "Error registrado",
  tested:     "Prueba de conexión",
  synced:     "Sincronización",
};
