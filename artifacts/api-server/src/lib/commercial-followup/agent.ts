import { eq } from "drizzle-orm";
import { db, agentsTable, mundosTable, directorsTable } from "@workspace/db";

// Exported so repository.ts can look up which clients have this agent
// assigned (agent_clients) without duplicating the name string — P-81 Fase
// A made this agent multi-tenant: same code/cron/logic, scoped by
// prospect.clientId, rather than a separate agent per client.
export const AGENT_NAME = "Agente de Seguimiento Comercial";

// Idempotent, same pattern as seedMundos()/seedDirectors() in mundos.ts —
// safe to call on every server boot. Looks up Mundo Comercial / Director
// Comercial by their seeded keys rather than hardcoding an id, since those
// rows are themselves seeded lazily and their ids aren't fixed.
export async function ensureCommercialFollowupAgent(): Promise<void> {
  const [existing] = await db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.name, AGENT_NAME));
  if (existing) return;

  const [mundo] = await db.select({ id: mundosTable.id }).from(mundosTable).where(eq(mundosTable.key, "mundo_comercial"));
  const [director] = await db.select({ id: directorsTable.id }).from(directorsTable).where(eq(directorsTable.key, "director_comercial"));

  await db.insert(agentsTable).values({
    name: AGENT_NAME,
    role: "Seguimiento automático de prospectos — Coimagen y clientes con este módulo activo",
    category: "Ventas",
    mundoId: mundo?.id ?? null,
    directorId: director?.id ?? null,
    specialty: "Email de seguimiento comercial",
    objetivo: "Reactivar prospectos en estado Lead sin seguimiento reciente, enviando correo 2/3/4 según días transcurridos. Opera sobre los leads propios de Coimagen (Diagnóstico Digital) y, para cada cliente con este módulo en su plan, únicamente sobre los prospectos de ese cliente.",
    status: "active",
    priority: "high",
  });
}
