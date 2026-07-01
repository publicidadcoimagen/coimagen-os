export const AUTOMATION_STATUSES: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",  color: "bg-muted/20 text-muted-foreground border-muted/30" },
  active:   { label: "Activa",   color: "bg-green-400/15 text-green-400 border-green-400/30" },
  paused:   { label: "Pausada",  color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  error:    { label: "Error",    color: "bg-red-400/15 text-red-400 border-red-400/30" },
  archived: { label: "Archivada",color: "bg-slate-400/15 text-slate-400 border-slate-400/30" },
};

export const AUTOMATION_PRIORITIES: Record<string, { label: string; color: string }> = {
  low:      { label: "Baja",     color: "text-muted-foreground" },
  medium:   { label: "Media",    color: "text-blue-400" },
  high:     { label: "Alta",     color: "text-orange-400" },
  critical: { label: "Crítica",  color: "text-red-400" },
};

export const TRIGGER_TYPES: { value: string; label: string; group: string }[] = [
  { value: "client_created",           label: "Cliente creado",              group: "Clientes" },
  { value: "prospect_created",         label: "Prospecto creado",            group: "Clientes" },
  { value: "project_created",          label: "Proyecto creado",             group: "Proyectos" },
  { value: "contract_signed",          label: "Contrato firmado",            group: "Proyectos" },
  { value: "invoice_overdue",          label: "Factura vencida",             group: "Finanzas" },
  { value: "payment_received",         label: "Pago recibido",               group: "Finanzas" },
  { value: "workflow_stage_changed",   label: "Workflow cambia de etapa",    group: "Workflows" },
  { value: "approval_pending",         label: "Aprobación pendiente",        group: "Aprobaciones" },
  { value: "approval_completed",       label: "Aprobación completada",       group: "Aprobaciones" },
  { value: "critical_bug_created",     label: "Bug crítico creado",          group: "Quality Center" },
  { value: "integration_error",        label: "Integración con error",       group: "Integraciones" },
  { value: "task_overdue",             label: "Tarea vencida",               group: "Tareas" },
  { value: "agent_status_changed",     label: "Agente cambia de estado",     group: "Agentes" },
  { value: "daily_sprint_created",     label: "Daily Sprint creado",         group: "Operaciones" },
  { value: "manual",                   label: "Manual",                       group: "General" },
];

export const CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: "cliente",         label: "Cliente" },
  { value: "proyecto",        label: "Proyecto" },
  { value: "estado",          label: "Estado" },
  { value: "prioridad",       label: "Prioridad" },
  { value: "fecha",           label: "Fecha" },
  { value: "módulo",          label: "Módulo" },
  { value: "rol",             label: "Rol" },
  { value: "agente",          label: "Agente" },
  { value: "integración",     label: "Integración" },
  { value: "workflow_stage",  label: "Etapa de Workflow" },
];

export const INTERNAL_ACTIONS: { value: string; label: string; description: string }[] = [
  { value: "Crear tarea",                    label: "Crear tarea",                    description: "Genera una tarea en el módulo de proyectos" },
  { value: "Crear ticket en Quality Center", label: "Crear ticket QC",                description: "Abre un ticket de calidad" },
  { value: "Crear evento en Workflow Engine",label: "Crear evento Workflow",           description: "Registra un evento de orquestación" },
  { value: "Asignar agente",                 label: "Asignar agente",                 description: "Asigna un agente responsable" },
  { value: "Cambiar estado",                 label: "Cambiar estado",                 description: "Cambia el estado de un registro" },
  { value: "Crear recordatorio",             label: "Crear recordatorio",             description: "Registra un recordatorio interno" },
  { value: "Agregar nota",                   label: "Agregar nota",                   description: "Agrega una nota al registro" },
  { value: "Registrar audit log",            label: "Registrar audit log",            description: "Escribe en el log de auditoría" },
  { value: "Generar checklist",              label: "Generar checklist",              description: "Crea una lista de verificación" },
  { value: "Crear backlog item",             label: "Crear backlog item",             description: "Agrega un ítem al backlog del proyecto" },
];

export const EXTERNAL_ACTIONS: { value: string; label: string; requiresIntegration: string; available: boolean }[] = [
  { value: "Enviar email Gmail",              label: "Enviar email Gmail",              requiresIntegration: "Gmail",                 available: false },
  { value: "Crear evento Calendar",           label: "Crear evento Calendar",           requiresIntegration: "Google Calendar",       available: false },
  { value: "Crear carpeta Drive",             label: "Crear carpeta Drive",             requiresIntegration: "Google Drive",          available: false },
  { value: "Enviar WhatsApp",                 label: "Enviar WhatsApp",                 requiresIntegration: "WhatsApp Business",     available: false },
  { value: "Enviar formulario Jotform",       label: "Enviar formulario Jotform",       requiresIntegration: "Jotform",               available: false },
  { value: "Ejecutar webhook n8n",            label: "Ejecutar webhook n8n",            requiresIntegration: "n8n",                   available: false },
  { value: "Consultar Analytics",             label: "Consultar Analytics",             requiresIntegration: "Google Analytics",      available: false },
  { value: "Consultar Search Console",        label: "Consultar Search Console",        requiresIntegration: "Google Search Console", available: false },
];

export const LOG_RESULT_LABELS: Record<string, { label: string; color: string }> = {
  success:   { label: "Exitosa",   color: "bg-green-400" },
  error:     { label: "Error",     color: "bg-red-400" },
  simulated: { label: "Simulada",  color: "bg-blue-400" },
};
