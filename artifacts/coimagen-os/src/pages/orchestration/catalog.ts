export type EventCatalogItem = {
  id: string;
  label: string;
  source: string;
  description: string;
  priority: "low" | "normal" | "high" | "critical";
  suggestedActions: string[];
};

export const EVENT_CATALOG: EventCatalogItem[] = [
  {
    id: "nuevo_lead",
    label: "Nuevo Lead",
    source: "comercial",
    description: "Se registra un nuevo prospecto en el pipeline comercial",
    priority: "normal",
    suggestedActions: ["Notificar director", "Crear diagnóstico", "Asignar agente"],
  },
  {
    id: "nuevo_cliente",
    label: "Nuevo Cliente",
    source: "comercial",
    description: "Un prospecto se convierte en cliente activo",
    priority: "high",
    suggestedActions: ["Crear proyecto", "Iniciar onboarding", "Crear Client Room"],
  },
  {
    id: "contrato_firmado",
    label: "Contrato Firmado",
    source: "contratos",
    description: "Se firma un contrato de servicio",
    priority: "critical",
    suggestedActions: ["Crear proyecto", "Crear backlog", "Crear workflow", "Asignar director", "Asignar agentes", "Crear checklist", "Crear Client Room", "Crear carpeta documental"],
  },
  {
    id: "pago_recibido",
    label: "Pago Recibido",
    source: "finanzas",
    description: "Se confirma un pago del cliente",
    priority: "high",
    suggestedActions: ["Actualizar estado proyecto", "Notificar equipo", "Registrar en finanzas"],
  },
  {
    id: "workflow_iniciado",
    label: "Workflow Iniciado",
    source: "workflow",
    description: "Se inicia un workflow de producción",
    priority: "normal",
    suggestedActions: ["Asignar tareas", "Notificar cliente", "Crear checklist de inicio"],
  },
  {
    id: "workflow_detenido",
    label: "Workflow Detenido",
    source: "workflow",
    description: "Un workflow se pausa o detiene",
    priority: "high",
    suggestedActions: ["Notificar CEO", "Registrar motivo", "Escalar si crítico"],
  },
  {
    id: "nueva_tarea",
    label: "Nueva Tarea",
    source: "proyectos",
    description: "Se crea una nueva tarea en un proyecto",
    priority: "low",
    suggestedActions: ["Asignar agente", "Establecer deadline", "Vincular a proyecto"],
  },
  {
    id: "bug_critico",
    label: "Bug Crítico",
    source: "quality",
    description: "Se reporta un bug crítico en el sistema",
    priority: "critical",
    suggestedActions: ["Notificar CEO", "Pausar entrega", "Asignar QA urgente", "Registrar incidente"],
  },
  {
    id: "factura_vencida",
    label: "Factura Vencida",
    source: "finanzas",
    description: "Una factura supera su fecha de vencimiento sin pago",
    priority: "high",
    suggestedActions: ["Notificar cliente", "Escalar a director", "Pausar proyecto si > 30 días"],
  },
  {
    id: "aprobacion_cliente",
    label: "Aprobación Cliente",
    source: "client_room",
    description: "El cliente aprueba o solicita cambios en un entregable",
    priority: "normal",
    suggestedActions: ["Actualizar estado entregable", "Notificar equipo creativo", "Actualizar timeline"],
  },
  {
    id: "nueva_automatizacion",
    label: "Nueva Automatización",
    source: "automatizaciones",
    description: "Se configura una nueva automatización en el sistema",
    priority: "normal",
    suggestedActions: ["Validar configuración", "Registrar en audit log", "Notificar admin"],
  },
  {
    id: "error_ia",
    label: "Error IA",
    source: "agentes",
    description: "Un agente de IA reporta un error o fallo de ejecución",
    priority: "high",
    suggestedActions: ["Registrar error", "Escalar a supervisor", "Reintentar o fallback manual"],
  },
  {
    id: "cliente_inactivo",
    label: "Cliente Inactivo",
    source: "comercial",
    description: "Un cliente no tiene actividad en más de 30 días",
    priority: "normal",
    suggestedActions: ["Asignar seguimiento", "Programar reunión reactivación", "Notificar director"],
  },
];

export const SOURCE_LABELS: Record<string, string> = {
  comercial:       "Comercial",
  contratos:       "Contratos",
  finanzas:        "Finanzas",
  workflow:        "Workflow Engine",
  proyectos:       "Proyectos",
  quality:         "Quality Center",
  client_room:     "Client Room",
  automatizaciones:"Automatizaciones",
  agentes:         "Agentes IA",
  manual:          "Manual",
};

export const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:      { label: "Baja",     color: "bg-slate-400/15 text-slate-400 border-slate-400/30" },
  normal:   { label: "Normal",   color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  high:     { label: "Alta",     color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  critical: { label: "Crítica",  color: "bg-red-400/15 text-red-400 border-red-400/30" },
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pendiente",  color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  active:    { label: "Activo",     color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  completed: { label: "Completado", color: "bg-green-400/15 text-green-400 border-green-400/30" },
  failed:    { label: "Fallido",    color: "bg-red-400/15 text-red-400 border-red-400/30" },
};

export function getEventLabel(id: string): string {
  return EVENT_CATALOG.find((e) => e.id === id)?.label ?? id;
}
