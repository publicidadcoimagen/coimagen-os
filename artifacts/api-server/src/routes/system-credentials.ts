import { Router, type IRouter } from "express";
import { db, systemCredentialsTable, encrypt, type SystemCredential } from "@workspace/db";
import { UpsertSystemCredentialBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

// Mounted at /system-credentials — account-level secrets (e.g. Coimagen's own
// Metricool USER_TOKEN/USER_ID) that don't belong to any one client. See
// social-credentials.ts for the per-client equivalent.
const router: IRouter = Router();

// Never includes encryptedValue — this is the only shape credentials are
// ever returned in, list or upsert.
function serializeMeta(c: SystemCredential) {
  return {
    id: c.id,
    provider: c.provider,
    credentialType: c.credentialType,
    status: c.status,
    lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    updatedBy: c.updatedBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
  };
}

router.get("/", requireRole("ceo", "admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(systemCredentialsTable).orderBy(systemCredentialsTable.provider);
  res.json(rows.map(serializeMeta));
});

router.put("/:provider/:credentialType", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const provider = req.params.provider as string;
  const credentialType = req.params.credentialType as string;
  const body = UpsertSystemCredentialBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(systemCredentialsTable).values({
    provider,
    credentialType,
    encryptedValue: encrypt(body.data.value),
    status: "active",
    updatedBy: req.user?.email ?? null,
  }).onConflictDoUpdate({
    target: [systemCredentialsTable.provider, systemCredentialsTable.credentialType],
    set: {
      encryptedValue: encrypt(body.data.value),
      status: "active",
      updatedBy: req.user?.email ?? null,
      updatedAt: new Date(),
    },
  }).returning();
  res.json(serializeMeta(row!));
});

export default router;
