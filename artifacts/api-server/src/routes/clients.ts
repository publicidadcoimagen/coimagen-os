import { Router, type IRouter } from "express";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { db, clientsTable, prospectsTable, clientTimelineTable, incidentsTable, invoicesTable, subscriptionsTable, contractsTable, usersTable, auditLogsTable } from "@workspace/db";
import {
  GetClientParams,
  UpdateClientParams,
  UpdateClientBody,
  DeleteClientParams,
  CreateClientBody,
  MarkClientFounderParams,
  MarkClientFounderBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { sendFounderWelcomeEmail } from "../lib/founder-welcome/email";
import { logger } from "../lib/logger";
import { grantPortalAccess } from "../lib/portal-onboarding/grant-portal-access";
import { resendPortalAccess } from "../lib/portal-onboarding/resend-portal-access";
import { proBonoChange } from "../lib/clients/pro-bono";
import { buildClientOverview } from "../lib/client-overview/build";

const router: IRouter = Router();

// Confirmed by Camila 2026-08-11. Change here (and only here) if the offer
// size ever changes — every "how many spots left" check reads this.
export const MAX_FOUNDERS = 20;

router.get("/clients", async (req, res): Promise<void> => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
  res.json(clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
  })));
});

router.post("/clients", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const role = (req.user as { role?: string }).role;
  if (!proBonoChange(role, false, parsed.data.accessGateExempt).allowed) {
    res.status(403).json({ error: "Solo la CEO puede crear una cuenta pro-bono" });
    return;
  }
  const [client] = await db.insert(clientsTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    company: parsed.data.company ?? null,
    industry: parsed.data.industry ?? null,
    status: parsed.data.status ?? "prospect",
    notes: parsed.data.notes ?? null,
    language: parsed.data.language ?? "es",
    accessGateExempt: parsed.data.accessGateExempt ?? false,
  }).returning();
  if (client.accessGateExempt) {
    await db.insert(auditLogsTable).values({
      userId: (req.user as { id: string }).id,
      module: "Clientes",
      action: "Marcar pro-bono permanente",
      result: `Cliente #${client.id} (${client.name}) creado como pro-bono permanente`,
      status: "success",
      metadata: JSON.stringify({ clientId: client.id, field: "accessGateExempt", from: null, to: true }),
    });
  }
  res.status(201).json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt ? client.updatedAt.toISOString() : null,
  });
});

// One health row per client for the CEO's client list (payments, contract,
// portal access, modules, pro bono). Registered before /clients/:id so
// "overview" is never parsed as an id. Staff-only in practice:
// clientRoleGate default-denies it for cliente accounts.
router.get("/clients/overview", async (_req, res): Promise<void> => {
  const [clients, invoices, subscriptions, contracts, portalUsers] = await Promise.all([
    db.select({ id: clientsTable.id, enabledModules: clientsTable.enabledModules, accessGateExempt: clientsTable.accessGateExempt }).from(clientsTable),
    db.select({ clientId: invoicesTable.clientId, status: invoicesTable.status, dueDate: invoicesTable.dueDate }).from(invoicesTable),
    db.select({ clientId: subscriptionsTable.clientId, status: subscriptionsTable.status, createdAt: subscriptionsTable.createdAt }).from(subscriptionsTable),
    db.select({ clientId: contractsTable.clientId, status: contractsTable.status, isTest: contractsTable.isTest, createdAt: contractsTable.createdAt }).from(contractsTable),
    db.select({ clientId: usersTable.clientId }).from(usersTable).where(and(eq(usersTable.role, "cliente"), isNotNull(usersTable.clientId))),
  ]);
  res.json(buildClientOverview({
    clients,
    invoices,
    subscriptions,
    contracts,
    portalClientIds: new Set(portalUsers.map((u) => u.clientId!)),
    today: new Date().toISOString().slice(0, 10),
  }));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt ? client.updatedAt.toISOString() : null,
  });
});

router.patch("/clients/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [before] = await db.select({ accessGateExempt: clientsTable.accessGateExempt }).from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const proBono = proBonoChange((req.user as { role?: string }).role, before.accessGateExempt, parsed.data.accessGateExempt);
  if (!proBono.allowed) {
    res.status(403).json({ error: "Solo la CEO puede cambiar el estado pro-bono" });
    return;
  }
  const [client] = await db.update(clientsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clientsTable.id, params.data.id))
    .returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  if (proBono.changed) {
    await db.insert(auditLogsTable).values({
      userId: (req.user as { id: string }).id,
      module: "Clientes",
      action: client.accessGateExempt ? "Marcar pro-bono permanente" : "Quitar pro-bono permanente",
      result: `Cliente #${client.id} (${client.name}) accessGateExempt ${before.accessGateExempt} → ${client.accessGateExempt}`,
      status: "success",
      metadata: JSON.stringify({ clientId: client.id, field: "accessGateExempt", from: before.accessGateExempt, to: client.accessGateExempt }),
    });
  }
  res.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt ? client.updatedAt.toISOString() : null,
  });
});

router.post("/clients/:id/mark-founder", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = MarkClientFounderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = MarkClientFounderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  if (existing.isFounder) {
    res.status(400).json({ error: `Client is already Founder #${existing.founderNumber}` });
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientsTable)
    .where(eq(clientsTable.isFounder, true));
  if (count >= MAX_FOUNDERS) {
    res.status(400).json({ error: `Ya se alcanzó el máximo de ${MAX_FOUNDERS} Fundadores` });
    return;
  }
  const founderNumber = count + 1;

  const [client] = await db.update(clientsTable)
    .set({ isFounder: true, founderNumber, updatedAt: new Date() })
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  // clients has no FK to prospects (they're created independently) — best
  // match available today is the most recent prospect with the same email,
  // same lookup shape as commercial-followup. Falls back to "es" like that
  // column's own default for prospects that predate it.
  let lang: "es" | "en" = "es";
  if (client.email) {
    const [prospect] = await db
      .select({ language: prospectsTable.language })
      .from(prospectsTable)
      .where(eq(prospectsTable.email, client.email))
      .orderBy(desc(prospectsTable.createdAt))
      .limit(1);
    if (prospect?.language === "en") lang = "en";
  }

  let emailSent = false;
  let emailError: string | null = null;
  if (client.email) {
    try {
      const emailId = await sendFounderWelcomeEmail(client.name, client.email, founderNumber, parsed.data.packageName, lang);
      emailSent = true;
      await db.insert(clientTimelineTable).values({
        clientId: client.id,
        eventType: "founder_marked",
        title: `Marcado como Fundador #${founderNumber}`,
        description: `Plan: ${parsed.data.packageName}. Correo de bienvenida enviado (${lang}), id ${emailId}.`,
      });
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      logger.warn({ err, clientId: client.id, founderNumber }, "No se pudo enviar el correo de bienvenida de Fundador (reintentos agotados)");
      await db.insert(clientTimelineTable).values({
        clientId: client.id,
        eventType: "founder_marked",
        title: `Marcado como Fundador #${founderNumber}`,
        description: `Plan: ${parsed.data.packageName}. Correo de bienvenida NO se pudo enviar: ${emailError}`,
      });
      // Reintentos agotados en sendFounderWelcomeEmail — esto ya no es un
      // problema de "un correo se perdió", es una falla técnica real
      // (Resend caído, API key inválida/vencida) que necesita ser visible
      // a nivel de sistema, no solo enterrada en el timeline de un cliente.
      // Mismo patrón que ya usa el Agente de Diagnóstico Digital.
      await db.insert(incidentsTable).values({
        type: "email_delivery_failure",
        title: `No se pudo enviar el correo de bienvenida de Fundador #${founderNumber}`,
        description: `Cliente: ${client.name} <${client.email}>\nPlan: ${parsed.data.packageName}\n\nError tras 3 intentos: ${emailError}`,
        severity: "high",
        priority: "high",
        status: "open",
        module: "Founder Welcome Email",
        clientId: client.id,
      });
    }
  } else {
    emailError = "Client has no email on file";
    await db.insert(clientTimelineTable).values({
      clientId: client.id,
      eventType: "founder_marked",
      title: `Marcado como Fundador #${founderNumber}`,
      description: `Plan: ${parsed.data.packageName}. Sin email registrado — no se envió correo de bienvenida.`,
    });
  }

  res.json({
    client: {
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt ? client.updatedAt.toISOString() : null,
    },
    emailSent,
    emailError,
  });
});

// Staff button "Enviar acceso al portal": gives any client a portal login
// without waiting for a paid proposal installment. Sends a real email.
router.post("/clients/:id/portal-access", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = req.user as { id: string; name?: string | null; email?: string | null };
  const result = await grantPortalAccess(params.data.id, { id: user.id, label: user.name || user.email || user.id });
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  res.status(201).json({ emailSent: result.emailSent });
});

// Staff button "Reenviar acceso": new temporary password for a client that
// already has a portal login, emailed again. The password never leaves the
// email — the response is only { ok, emailSent }.
router.post("/clients/:id/portal-access/resend", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = req.user as { id: string; name?: string | null; email?: string | null };
  const result = await resendPortalAccess(params.data.id, { id: user.id, label: user.name || user.email || user.id });
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  res.json({ ok: true, emailSent: result.emailSent });
});

router.delete("/clients/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
