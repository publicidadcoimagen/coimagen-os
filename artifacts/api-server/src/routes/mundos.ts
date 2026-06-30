import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  mundosTable,
  directorsTable,
  directorClientsTable,
  directorProjectsTable,
  clientsTable,
  projectsTable,
} from "@workspace/db";
import { GetMundoParams, UpdateMundoParams, UpdateMundoBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SEED_MUNDOS = [
  {
    key: "mundo_comercial", name: "Mundo Comercial", emoji: "🌍", sortOrder: 1, directorKey: "director_comercial",
    description: "Ecosistema completo de adquisición y gestión del pipeline comercial de Coimagen Media Agency.",
    objetivo: "Convertir prospectos en clientes de alto valor y escalar el pipeline comercial de forma sostenible.",
    kpis: ["Tasa de conversión de prospectos (%)", "Valor promedio de contrato (MXN)", "Tiempo de ciclo de venta (días)", "Propuestas enviadas/mes", "Pipeline total calificado"],
  },
  {
    key: "mundo_marketing", name: "Mundo Marketing", emoji: "🌍", sortOrder: 2, directorKey: "director_marketing",
    description: "Universo de marca, contenido y posicionamiento de Coimagen en el ecosistema digital.",
    objetivo: "Posicionar a Coimagen como referente en IA aplicada al marketing en Latinoamérica.",
    kpis: ["Alcance orgánico mensual", "Engagement rate (%)", "Leads inbound/mes", "Costo por lead (CPL)", "Crecimiento de seguidores MoM (%)"],
  },
  {
    key: "mundo_produccion", name: "Mundo Producción", emoji: "🌍", sortOrder: 3, directorKey: "director_produccion",
    description: "Centro de operaciones creativas y entrega de proyectos para todos los clientes activos.",
    objetivo: "Garantizar entregas puntuales y de alta calidad que superen las expectativas en cada proyecto.",
    kpis: ["% proyectos entregados a tiempo", "CSAT del cliente", "Revisiones promedio/proyecto", "Velocidad de producción (entregables/semana)", "Tasa de retrabajos (%)"],
  },
  {
    key: "mundo_seo", name: "Mundo SEO", emoji: "🌍", sortOrder: 4, directorKey: "director_seo",
    description: "Motor de visibilidad orgánica para Coimagen y su cartera de clientes con proyectos SEO.",
    objetivo: "Maximizar el tráfico orgánico cualificado y el posicionamiento en motores de búsqueda.",
    kpis: ["Posiciones en top 10 SERP", "Tráfico orgánico mensual (sesiones)", "Autoridad de dominio (DA)", "Conversiones orgánicas", "Keywords en primera página (%)"],
  },
  {
    key: "mundo_automatizacion", name: "Mundo Automatización", emoji: "🌍", sortOrder: 5, directorKey: "director_automatizacion",
    description: "Fábrica de workflows y automatizaciones que potencian la capacidad operativa de la agencia.",
    objetivo: "Reducir el trabajo manual en un 70% mediante automatizaciones inteligentes y procesos IA.",
    kpis: ["Horas ahorradas/mes", "Flujos activos en producción", "Tasa de éxito de automatizaciones (%)", "ROI de automatizaciones", "Nuevos flujos/mes"],
  },
  {
    key: "mundo_clientes", name: "Mundo Clientes", emoji: "🌍", sortOrder: 6, directorKey: "director_clientes",
    description: "Hub de relaciones, satisfacción y crecimiento de la cartera de clientes activos.",
    objetivo: "Mantener retención del 95%+ y maximizar el Lifetime Value (LTV) de cada cliente.",
    kpis: ["Net Promoter Score (NPS)", "Retención mensual (%)", "Tiempo de respuesta (horas)", "Upsells/trimestre", "Churn rate (%)"],
  },
  {
    key: "mundo_administracion", name: "Mundo Administración", emoji: "🌍", sortOrder: 7, directorKey: "director_administracion",
    description: "Núcleo de gestión documental, legal y cumplimiento normativo de la agencia.",
    objetivo: "Mantener la operación administrativa eficiente y en pleno cumplimiento regulatorio.",
    kpis: ["Tiempo de procesamiento de documentos (días)", "% contratos firmados a tiempo", "Incidencias administrativas/mes", "Nivel de digitalización (%)", "Cumplimiento de auditorías (%)"],
  },
  {
    key: "mundo_finanzas", name: "Mundo Finanzas", emoji: "🌍", sortOrder: 8, directorKey: "director_finanzas",
    description: "Centro de control financiero con visibilidad completa de ingresos, costos y proyecciones.",
    objetivo: "Mantener márgenes saludables y visibilidad financiera en tiempo real para decisiones estratégicas.",
    kpis: ["Margen bruto mensual (%)", "Días promedio de cobro (DSO)", "MRR (Monthly Recurring Revenue)", "Flujo de caja 30/60/90 días", "EBITDA mensual"],
  },
  {
    key: "mundo_cloud_systems", name: "Mundo Cloud Systems", emoji: "🌍", sortOrder: 9, directorKey: "director_cloud_systems",
    description: "Infraestructura tecnológica y sistemas que sostienen toda la operación de Coimagen.",
    objetivo: "Garantizar disponibilidad, seguridad y escalabilidad de la infraestructura al 99.9%+.",
    kpis: ["Uptime de sistemas (%)", "Incidencias de seguridad/mes", "Costo de infraestructura (MXN/mes)", "MTTR (tiempo de resolución)", "Score de seguridad"],
  },
  {
    key: "mundo_ia", name: "Mundo IA", emoji: "🌍", sortOrder: 10, directorKey: "director_ia",
    description: "Núcleo de inteligencia artificial que impulsa la transformación y ventaja competitiva de Coimagen.",
    objetivo: "Integrar IA en todos los procesos clave para multiplicar la capacidad operativa de la agencia.",
    kpis: ["Procesos con IA integrada", "Mejora de productividad (%)", "Costo por inferencia/operación", "Nuevas capacidades IA/trimestre", "Horas ahorradas por agentes IA/mes"],
  },
];

async function seedMundos() {
  const existing = await db.select({ id: mundosTable.id }).from(mundosTable).limit(1);
  if (existing.length > 0) return;
  const directors = await db.select({ id: directorsTable.id, key: directorsTable.key }).from(directorsTable);
  if (directors.length === 0) return; // directors not seeded yet
  const byKey = new Map(directors.map((d) => [d.key, d.id]));
  await db.insert(mundosTable).values(
    SEED_MUNDOS.map(({ directorKey, ...rest }) => ({
      ...rest,
      directorId: byKey.get(directorKey) ?? null,
    }))
  );
}

async function getMundoWithRelations(mundoId: number) {
  const [mundo] = await db.select().from(mundosTable).where(eq(mundosTable.id, mundoId));
  if (!mundo) return null;

  const director = mundo.directorId
    ? (await db.select({ id: directorsTable.id, key: directorsTable.key, name: directorsTable.name, description: directorsTable.description, objetivo: directorsTable.objetivo, responsabilidades: directorsTable.responsabilidades }).from(directorsTable).where(eq(directorsTable.id, mundo.directorId)))[0] ?? null
    : null;

  const assignedClients = director
    ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(directorClientsTable).innerJoin(clientsTable, eq(directorClientsTable.clientId, clientsTable.id)).where(eq(directorClientsTable.directorId, director.id))
    : [];

  const assignedProjects = director
    ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(directorProjectsTable).innerJoin(projectsTable, eq(directorProjectsTable.projectId, projectsTable.id)).where(eq(directorProjectsTable.directorId, director.id))
    : [];

  return {
    ...mundo,
    director: director ?? null,
    agentCount: 0,
    automationCount: 0,
    taskCount: 0,
    assignedClients,
    assignedProjects,
    createdAt: mundo.createdAt.toISOString(),
    updatedAt: mundo.updatedAt ? mundo.updatedAt.toISOString() : null,
  };
}

router.get("/mundos", async (req, res): Promise<void> => {
  await seedMundos();
  const mundos = await db.select().from(mundosTable).orderBy(mundosTable.sortOrder);

  const results = await Promise.all(mundos.map(async (m) => {
    const director = m.directorId
      ? (await db.select({ id: directorsTable.id, key: directorsTable.key, name: directorsTable.name, description: directorsTable.description, objetivo: directorsTable.objetivo, responsabilidades: directorsTable.responsabilidades }).from(directorsTable).where(eq(directorsTable.id, m.directorId)))[0] ?? null
      : null;

    const assignedClients = director
      ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(directorClientsTable).innerJoin(clientsTable, eq(directorClientsTable.clientId, clientsTable.id)).where(eq(directorClientsTable.directorId, director.id))
      : [];

    const assignedProjects = director
      ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(directorProjectsTable).innerJoin(projectsTable, eq(directorProjectsTable.projectId, projectsTable.id)).where(eq(directorProjectsTable.directorId, director.id))
      : [];

    return {
      ...m,
      director: director ?? null,
      agentCount: 0,
      automationCount: 0,
      taskCount: 0,
      assignedClients,
      assignedProjects,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
    };
  }));

  res.json(results);
});

router.get("/mundos/:id", async (req, res): Promise<void> => {
  const parsed = GetMundoParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const mundo = await getMundoWithRelations(parsed.data.id);
  if (!mundo) { res.status(404).json({ error: "Mundo not found" }); return; }
  res.json(mundo);
});

router.patch("/mundos/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateMundoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateMundoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.objetivo !== undefined) updateData.objetivo = parsed.data.objetivo;
  if (parsed.data.kpis !== undefined) updateData.kpis = parsed.data.kpis;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.directorId !== undefined) updateData.directorId = parsed.data.directorId;

  await db.update(mundosTable).set(updateData).where(eq(mundosTable.id, params.data.id));
  const mundo = await getMundoWithRelations(params.data.id);
  if (!mundo) { res.status(404).json({ error: "Mundo not found" }); return; }
  res.json(mundo);
});

export default router;
