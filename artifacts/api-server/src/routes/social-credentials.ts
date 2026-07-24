import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientSocialCredentialsTable, encrypt, type ClientSocialCredential } from "@workspace/db";
import { CreateClientSocialCredentialBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

// Mounted at /clients/:clientId/social-credentials — mergeParams so
// :clientId from the parent mount is visible on req.params here.
const router: IRouter = Router({ mergeParams: true });

// Never includes encryptedValue — this is the only shape credentials are
// ever returned in, list or create.
function serializeMeta(c: ClientSocialCredential) {
  return {
    id: c.id,
    clientId: c.clientId,
    platform: c.platform,
    credentialType: c.credentialType,
    scopes: c.scopes,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    status: c.status,
    lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
  };
}

router.get("/", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const rows = await db.select().from(clientSocialCredentialsTable)
    .where(eq(clientSocialCredentialsTable.clientId, clientId));
  res.json(rows.map(serializeMeta));
});

router.post("/", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const body = CreateClientSocialCredentialBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [row] = await db.insert(clientSocialCredentialsTable).values({
    clientId,
    platform: d.platform,
    credentialType: d.credentialType,
    encryptedValue: encrypt(d.value),
    scopes: d.scopes ?? null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    status: "active",
  }).returning();
  res.status(201).json(serializeMeta(row!));
});

export default router;
