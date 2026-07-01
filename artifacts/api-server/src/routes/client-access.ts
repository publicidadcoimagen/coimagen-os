import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientAccessTable, auditLogsTable } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const serializeAccess = (r: typeof clientAccessTable.$inferSelect) => ({
  ...r,
  lastVerified: r.lastVerified ? r.lastVerified.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
});

router.get("/clients/:clientId/access", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const rows = await db.select().from(clientAccessTable)
    .where(eq(clientAccessTable.clientId, clientId))
    .orderBy(clientAccessTable.createdAt);
  res.json(rows.map(serializeAccess));
});

router.post("/clients/:clientId/access", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const body = req.body;
  const [row] = await db.insert(clientAccessTable).values({
    clientId,
    accessType: body.accessType ?? "other",
    platform: body.platform ?? null,
    accountName: body.accountName ?? null,
    loginUrl: body.loginUrl ?? null,
    usernameEmail: body.usernameEmail ?? null,
    passwordPlaceholder: body.passwordPlaceholder ?? null,
    apiKeyPlaceholder: body.apiKeyPlaceholder ?? null,
    tokenPlaceholder: body.tokenPlaceholder ?? null,
    permissionStatus: body.permissionStatus ?? "not_requested",
    accessStatus: body.accessStatus ?? "pending",
    lastVerified: body.lastVerified ? new Date(body.lastVerified) : null,
    notes: body.notes ?? null,
  }).returning();
  await db.insert(auditLogsTable).values({
    userId: "camila.segovia",
    module: "Clientes",
    action: "Registrar acceso",
    result: `Acceso ${row.accessType} creado para cliente ${clientId}`,
    status: "success",
  });
  res.status(201).json(serializeAccess(row));
});

router.patch("/clients/:clientId/access/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  const id = parseInt(req.params.id as string);
  if (isNaN(clientId) || isNaN(id)) { res.status(400).json({ error: "Invalid params" }); return; }
  const body = req.body;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.accessType !== undefined) update.accessType = body.accessType;
  if (body.platform !== undefined) update.platform = body.platform;
  if (body.accountName !== undefined) update.accountName = body.accountName;
  if (body.loginUrl !== undefined) update.loginUrl = body.loginUrl;
  if (body.usernameEmail !== undefined) update.usernameEmail = body.usernameEmail;
  if (body.passwordPlaceholder !== undefined) update.passwordPlaceholder = body.passwordPlaceholder;
  if (body.apiKeyPlaceholder !== undefined) update.apiKeyPlaceholder = body.apiKeyPlaceholder;
  if (body.tokenPlaceholder !== undefined) update.tokenPlaceholder = body.tokenPlaceholder;
  if (body.permissionStatus !== undefined) update.permissionStatus = body.permissionStatus;
  if (body.accessStatus !== undefined) update.accessStatus = body.accessStatus;
  if (body.lastVerified !== undefined) update.lastVerified = body.lastVerified ? new Date(body.lastVerified) : null;
  if (body.notes !== undefined) update.notes = body.notes;
  const [row] = await db.update(clientAccessTable)
    .set(update)
    .where(and(eq(clientAccessTable.id, id), eq(clientAccessTable.clientId, clientId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(auditLogsTable).values({
    userId: "camila.segovia",
    module: "Clientes",
    action: "Actualizar acceso",
    result: `Acceso ${row.accessType} actualizado para cliente ${clientId}`,
    status: "success",
  });
  res.json(serializeAccess(row));
});

router.delete("/clients/:clientId/access/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  const id = parseInt(req.params.id as string);
  if (isNaN(clientId) || isNaN(id)) { res.status(400).json({ error: "Invalid params" }); return; }
  const [row] = await db.delete(clientAccessTable)
    .where(and(eq(clientAccessTable.id, id), eq(clientAccessTable.clientId, clientId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
