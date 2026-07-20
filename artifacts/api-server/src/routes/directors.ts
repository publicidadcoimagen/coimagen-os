import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  directorsTable,
  directorClientsTable,
  directorProjectsTable,
  clientsTable,
  projectsTable,
} from "@workspace/db";
import { UpdateDirectorBody, UpdateDirectorParams, GetDirectorParams, AssignDirectorClientBody, AssignDirectorClientParams, UnassignDirectorClientParams, AssignDirectorProjectBody, AssignDirectorProjectParams, UnassignDirectorProjectParams } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SEED_DIRECTORS = [
  {
    key: "director_comercial",
    name: "Director Comercial",
    description: "Lidera el proceso de adquisición de nuevos clientes desde la prospección hasta el cierre de contratos.",
    objetivo: "Escalar el pipeline comercial y convertir prospectos en clientes de alto valor para la agencia.",
    responsabilidades: [
      "Gestión integral del pipeline de ventas",
      "Cualificación y seguimiento de prospectos",
      "Coordinación de diagnósticos y propuestas comerciales",
      "Negociación y cierre de contratos",
      "Reporte mensual de métricas comerciales al CEO",
    ],
    kpis: [
      "Tasa de conversión de prospectos (%)",
      "Valor promedio de contrato (MXN)",
      "Tiempo promedio de ciclo de venta (días)",
      "Número de propuestas enviadas por mes",
      "Pipeline total calificado",
    ],
    sortOrder: 1,
  },
  {
    key: "director_marketing",
    name: "Director Marketing",
    description: "Gestiona la estrategia de marca, contenido y posicionamiento de Coimagen en el mercado digital.",
    objetivo: "Posicionar a Coimagen como agencia de referencia en IA aplicada al marketing en Latinoamérica.",
    responsabilidades: [
      "Estrategia de contenido multicanal",
      "Gestión y crecimiento de redes sociales",
      "Campañas de awareness y generación de leads",
      "Analítica de marketing y reportes de rendimiento",
      "Desarrollo de identidad de marca y materiales creativos",
    ],
    kpis: [
      "Alcance orgánico mensual",
      "Engagement rate promedio (%)",
      "Leads inbound generados por mes",
      "Costo por lead (CPL)",
      "Crecimiento de seguidores mes a mes (%)",
    ],
    sortOrder: 2,
  },
  {
    key: "director_produccion",
    name: "Director Producción",
    description: "Supervisa la entrega de proyectos y garantiza la calidad de todos los entregables hacia los clientes.",
    objetivo: "Garantizar entregas puntuales y de alta calidad que superen las expectativas del cliente en cada proyecto.",
    responsabilidades: [
      "Gestión de cronogramas y timelines de producción",
      "Control de calidad en todos los entregables",
      "Coordinación de equipos creativos y técnicos",
      "Gestión de revisiones y aprobaciones",
      "Optimización de flujos de producción",
    ],
    kpis: [
      "% de proyectos entregados a tiempo",
      "CSAT (índice de satisfacción del cliente)",
      "Número promedio de revisiones por proyecto",
      "Velocidad de producción (entregables/semana)",
      "Tasa de retrabajos (%)",
    ],
    sortOrder: 3,
  },
  {
    key: "director_seo",
    name: "Director SEO",
    description: "Lidera la estrategia de optimización en motores de búsqueda para Coimagen y sus clientes.",
    objetivo: "Maximizar la visibilidad orgánica y el tráfico cualificado para todos los proyectos SEO activos.",
    responsabilidades: [
      "Auditorías SEO técnicas y de contenido",
      "Estrategia de keywords y arquitectura de contenido",
      "Link building y autoridad de dominio",
      "Optimización técnica on-page y off-page",
      "Reportes mensuales de posicionamiento",
    ],
    kpis: [
      "Posiciones en top 10 SERP",
      "Tráfico orgánico mensual (sesiones)",
      "Autoridad de dominio (DA)",
      "Conversiones desde tráfico orgánico",
      "Keywords en primera página (%)",
    ],
    sortOrder: 4,
  },
  {
    key: "director_automatizacion",
    name: "Director Automatización",
    description: "Diseña e implementa flujos de automatización para escalar las operaciones de la agencia y sus clientes.",
    objetivo: "Reducir el trabajo manual en un 70% mediante automatizaciones inteligentes y procesos potenciados por IA.",
    responsabilidades: [
      "Diseño y arquitectura de workflows automatizados",
      "Integración de herramientas y plataformas",
      "Mantenimiento y monitoreo de flujos activos",
      "Documentación de procesos automatizados",
      "Evaluación e implementación de nuevas herramientas de automatización",
    ],
    kpis: [
      "Horas ahorradas por automatización (mensual)",
      "Número de flujos activos en producción",
      "Tasa de éxito de automatizaciones (%)",
      "ROI de automatizaciones implementadas",
      "Nuevos flujos implementados por mes",
    ],
    sortOrder: 5,
  },
  {
    key: "director_clientes",
    name: "Director Clientes",
    description: "Garantiza la satisfacción, retención y crecimiento de la cartera de clientes activos de la agencia.",
    objetivo: "Mantener una retención del 95%+ y maximizar el Lifetime Value (LTV) de cada cliente.",
    responsabilidades: [
      "Onboarding completo de nuevos clientes",
      "Gestión proactiva de comunicaciones con clientes",
      "Detección y desarrollo de oportunidades de upsell",
      "Resolución de incidencias y escalaciones",
      "Reviews periódicas de resultados con cada cliente",
    ],
    kpis: [
      "Net Promoter Score (NPS)",
      "Tasa de retención mensual (%)",
      "Tiempo promedio de respuesta (horas)",
      "Upsells generados por trimestre",
      "Churn rate (%)",
    ],
    sortOrder: 6,
  },
  {
    key: "director_administracion",
    name: "Director Administración",
    description: "Gestiona los procesos administrativos, legales y de cumplimiento normativo de la agencia.",
    objetivo: "Mantener la operación administrativa eficiente, ordenada y en pleno cumplimiento regulatorio.",
    responsabilidades: [
      "Gestión documental y archivo digital",
      "Contratos, acuerdos y validación legal",
      "Cumplimiento normativo y protección de datos",
      "Diseño y mejora de procesos internos",
      "Coordinación de protocolos y políticas internas",
    ],
    kpis: [
      "Tiempo de procesamiento de documentos (días)",
      "% de contratos firmados a tiempo",
      "Incidencias administrativas por mes",
      "Nivel de digitalización documental (%)",
      "Cumplimiento de auditorías internas (%)",
    ],
    sortOrder: 7,
  },
  {
    key: "director_finanzas",
    name: "Director Finanzas",
    description: "Controla la salud financiera de la agencia, incluyendo ingresos, costos, márgenes y proyecciones.",
    objetivo: "Mantener márgenes saludables y visibilidad financiera completa en tiempo real para la toma de decisiones.",
    responsabilidades: [
      "Gestión de facturación e ingresos recurrentes",
      "Control y optimización de costos operativos",
      "Proyecciones financieras mensuales y anuales",
      "Reportes financieros para CEO y stakeholders",
      "Gestión de cobros, pagos y flujo de caja",
    ],
    kpis: [
      "Margen bruto mensual (%)",
      "Días promedio de cobro (DSO)",
      "MRR (Monthly Recurring Revenue)",
      "Flujo de caja proyectado (30/60/90 días)",
      "EBITDA mensual",
    ],
    sortOrder: 8,
  },
  {
    key: "director_cloud_systems",
    name: "Director Cloud Systems",
    description: "Administra la infraestructura cloud, herramientas SaaS y todos los sistemas tecnológicos de la agencia.",
    objetivo: "Garantizar disponibilidad, seguridad y escalabilidad de toda la infraestructura tecnológica al 99.9%+.",
    responsabilidades: [
      "Gestión de servidores, hosting y dominios",
      "Seguridad informática y control de accesos",
      "Administración de licencias y herramientas SaaS",
      "Monitoreo de sistemas y resolución de incidencias",
      "Planificación de arquitectura tecnológica",
    ],
    kpis: [
      "Uptime de sistemas (%)",
      "Incidencias de seguridad por mes",
      "Costo de infraestructura mensual (MXN)",
      "Tiempo de resolución de incidencias (horas)",
      "Score de seguridad (pentesting)",
    ],
    sortOrder: 9,
  },
  {
    key: "director_ia",
    name: "Director IA",
    description: "Lidera la estrategia de inteligencia artificial aplicada a los proyectos y a la operación interna de la agencia.",
    objetivo: "Integrar IA en todos los procesos clave para multiplicar la capacidad operativa y la propuesta de valor de Coimagen.",
    responsabilidades: [
      "Selección e implementación de modelos y herramientas IA",
      "Gestión estratégica del equipo de agentes de IA",
      "Investigación y evaluación de nuevas tecnologías IA",
      "Formación interna y cultura de IA en el equipo",
      "Desarrollo de casos de uso IA para clientes",
    ],
    kpis: [
      "Número de procesos con IA integrada",
      "Mejora de productividad medida (%)",
      "Costo por inferencia/operación IA",
      "Nuevas capacidades IA implementadas por trimestre",
      "Tiempo ahorrado gracias a agentes IA (horas/mes)",
    ],
    sortOrder: 10,
  },
];

async function seedDirectors() {
  const existing = await db.select({ id: directorsTable.id }).from(directorsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(directorsTable).values(SEED_DIRECTORS);
}

async function getDirectorWithRelations(directorId: number) {
  const [director] = await db.select().from(directorsTable).where(eq(directorsTable.id, directorId));
  if (!director) return null;

  const clientLinks = await db
    .select({ id: clientsTable.id, name: clientsTable.name })
    .from(directorClientsTable)
    .innerJoin(clientsTable, eq(directorClientsTable.clientId, clientsTable.id))
    .where(eq(directorClientsTable.directorId, directorId));

  const projectLinks = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(directorProjectsTable)
    .innerJoin(projectsTable, eq(directorProjectsTable.projectId, projectsTable.id))
    .where(eq(directorProjectsTable.directorId, directorId));

  return {
    ...director,
    agentCount: 0,
    automationCount: 0,
    assignedClients: clientLinks,
    assignedProjects: projectLinks,
    createdAt: director.createdAt.toISOString(),
    updatedAt: director.updatedAt ? director.updatedAt.toISOString() : null,
  };
}

router.get("/org/directors", async (req, res): Promise<void> => {
  await seedDirectors();
  const directors = await db.select().from(directorsTable).orderBy(directorsTable.sortOrder);

  const results = await Promise.all(directors.map(async (d) => {
    const clientLinks = await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(directorClientsTable)
      .innerJoin(clientsTable, eq(directorClientsTable.clientId, clientsTable.id))
      .where(eq(directorClientsTable.directorId, d.id));

    const projectLinks = await db
      .select({ id: projectsTable.id, name: projectsTable.name })
      .from(directorProjectsTable)
      .innerJoin(projectsTable, eq(directorProjectsTable.projectId, projectsTable.id))
      .where(eq(directorProjectsTable.directorId, d.id));

    return {
      ...d,
      agentCount: 0,
      automationCount: 0,
      assignedClients: clientLinks,
      assignedProjects: projectLinks,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
    };
  }));

  res.json(results);
});

router.get("/org/directors/:id", async (req, res): Promise<void> => {
  const parsed = GetDirectorParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const director = await getDirectorWithRelations(parsed.data.id);
  if (!director) { res.status(404).json({ error: "Director not found" }); return; }
  res.json(director);
});

router.patch("/org/directors/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateDirectorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateDirectorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.objetivo !== undefined) updateData.objetivo = parsed.data.objetivo;
  if (parsed.data.responsabilidades !== undefined) updateData.responsabilidades = parsed.data.responsabilidades;
  if (parsed.data.kpis !== undefined) updateData.kpis = parsed.data.kpis;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  await db.update(directorsTable).set(updateData).where(eq(directorsTable.id, params.data.id));
  const director = await getDirectorWithRelations(params.data.id);
  if (!director) { res.status(404).json({ error: "Director not found" }); return; }
  res.json(director);
});

router.post("/org/directors/:id/clients", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = AssignDirectorClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AssignDirectorClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(directorClientsTable).values({ directorId: params.data.id, clientId: parsed.data.clientId }).onConflictDoNothing();
  res.status(204).send();
});

router.delete("/org/directors/:id/clients/:clientId", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UnassignDirectorClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  await db.delete(directorClientsTable).where(and(eq(directorClientsTable.directorId, params.data.id), eq(directorClientsTable.clientId, params.data.clientId)));
  res.status(204).send();
});

router.post("/org/directors/:id/projects", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = AssignDirectorProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AssignDirectorProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(directorProjectsTable).values({ directorId: params.data.id, projectId: parsed.data.projectId }).onConflictDoNothing();
  res.status(204).send();
});

router.delete("/org/directors/:id/projects/:projectId", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UnassignDirectorProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  await db.delete(directorProjectsTable).where(and(eq(directorProjectsTable.directorId, params.data.id), eq(directorProjectsTable.projectId, params.data.projectId)));
  res.status(204).send();
});

export default router;
