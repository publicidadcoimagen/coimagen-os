import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, clientsTable, organizationsTable, clientImpersonationSessionsTable, auditLogsTable } from "@workspace/db";
import { ImpersonateClientParams, EndImpersonationBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SESSION_MINUTES = 30;

router.post("/clients/:id/impersonate", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Authentication required" }); return; }

  const params = ImpersonateClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.clientId, client.id));
  if (!org) { res.status(409).json({ error: "This client has no Client Room organization yet" }); return; }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000);
  await db.insert(clientImpersonationSessionsTable).values({
    token,
    staffUserId: req.user.id,
    clientId: client.id,
    expiresAt,
  });

  await db.insert(auditLogsTable).values({
    userId: req.user.id,
    module: "Clientes",
    action: "Ver como cliente",
    result: `Staff ${req.user.email ?? req.user.id} entró en modo 'ver como cliente' para ${client.name} (#${client.id})`,
    status: "success",
  });

  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    clientId: client.id,
    clientSlug: org.slug,
    clientName: client.name,
  });
});

router.post("/impersonation/end", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Authentication required" }); return; }

  const body = EndImpersonationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [session] = await db.select().from(clientImpersonationSessionsTable).where(eq(clientImpersonationSessionsTable.token, body.data.token));
  if (!session || session.endedAt) { res.status(404).json({ error: "Session not found or already ended" }); return; }

  const isOwner = session.staffUserId === req.user.id;
  const isStaffOverride = req.user.role === "ceo" || req.user.role === "admin";
  if (!isOwner && !isStaffOverride) { res.status(404).json({ error: "Session not found or already ended" }); return; }

  await db.update(clientImpersonationSessionsTable)
    .set({ endedAt: new Date() })
    .where(eq(clientImpersonationSessionsTable.id, session.id));

  const [client] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, session.clientId));
  await db.insert(auditLogsTable).values({
    userId: req.user.id,
    module: "Clientes",
    action: "Salió de modo 'ver como cliente'",
    result: `Staff ${req.user.email ?? req.user.id} salió del modo 'ver como cliente' para ${client?.name ?? `cliente #${session.clientId}`}`,
    status: "success",
  });

  res.sendStatus(204);
});

export default router;
