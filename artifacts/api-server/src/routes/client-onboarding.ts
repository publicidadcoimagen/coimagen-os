import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientOnboardingTable, type ClientOnboardingModuleContact } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";
import { ownsClientId } from "../middlewares/clientScope";

const router: IRouter = Router();

const serialize = (r: typeof clientOnboardingTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
});

function sanitizeModuleContacts(raw: unknown): ClientOnboardingModuleContact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      module: String(e.module ?? "").slice(0, 100),
      contactName: String(e.contactName ?? "").slice(0, 200),
      contactEmail: e.contactEmail ? String(e.contactEmail).slice(0, 200) : null,
      notes: e.notes ? String(e.notes).slice(0, 500) : null,
    }))
    .filter((e) => e.module && e.contactName);
}

router.get("/clients/:clientId/onboarding", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const [row] = await db.select().from(clientOnboardingTable).where(eq(clientOnboardingTable.clientId, clientId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.put("/clients/:clientId/onboarding", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const body = req.body;
  const [existing] = await db.select().from(clientOnboardingTable).where(eq(clientOnboardingTable.clientId, clientId));
  const values = {
    clientId,
    hasLogo: body.hasLogo ?? false,
    hasWebsiteAccess: body.hasWebsiteAccess ?? false,
    hasDomainAccess: body.hasDomainAccess ?? false,
    hasHostingAccess: body.hasHostingAccess ?? false,
    hasFacebookAccess: body.hasFacebookAccess ?? false,
    hasInstagramAccess: body.hasInstagramAccess ?? false,
    hasGoogleBusinessAccess: body.hasGoogleBusinessAccess ?? false,
    hasWhatsappAccess: body.hasWhatsappAccess ?? false,
    hasBrandColors: body.hasBrandColors ?? false,
    hasBusinessInfo: body.hasBusinessInfo ?? false,
    moduleContacts: sanitizeModuleContacts(body.moduleContacts),
    notes: body.notes ?? null,
    updatedAt: new Date(),
  };
  let row;
  if (existing) {
    [row] = await db.update(clientOnboardingTable).set(values).where(eq(clientOnboardingTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientOnboardingTable).values(values).returning();
  }
  res.json(serialize(row));
});

// Client self-service write, scoped to the caller's own clientId — separate
// from the staff PUT above (which stays full-overwrite/staff-only). A
// cliente-role account may only ever touch its own onboarding row; staff can
// also call this (ownsClientId always passes for staff) but the intended
// caller is the client themselves via the Client Room wizard.
router.patch("/clients/:clientId/onboarding", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId) || !ownsClientId(req, clientId)) { res.status(403).json({ error: "Not available for this account" }); return; }
  const body = req.body ?? {};
  const [existing] = await db.select().from(clientOnboardingTable).where(eq(clientOnboardingTable.clientId, clientId));

  const boolFields = [
    "hasLogo", "hasWebsiteAccess", "hasDomainAccess", "hasHostingAccess",
    "hasFacebookAccess", "hasInstagramAccess", "hasGoogleBusinessAccess", "hasWhatsappAccess",
    "hasBrandColors", "hasBusinessInfo",
  ] as const;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of boolFields) {
    if (key in body) patch[key] = !!body[key];
  }
  if ("moduleContacts" in body) patch.moduleContacts = sanitizeModuleContacts(body.moduleContacts);
  if ("notes" in body) patch.notes = body.notes ? String(body.notes).slice(0, 2000) : null;
  if (body.submit === true) patch.submittedAt = new Date();

  let row;
  if (existing) {
    [row] = await db.update(clientOnboardingTable).set(patch).where(eq(clientOnboardingTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientOnboardingTable).values({
      clientId,
      hasLogo: false, hasWebsiteAccess: false, hasDomainAccess: false, hasHostingAccess: false,
      hasFacebookAccess: false, hasInstagramAccess: false, hasGoogleBusinessAccess: false, hasWhatsappAccess: false,
      hasBrandColors: false, hasBusinessInfo: false, moduleContacts: [], notes: null,
      ...patch,
    }).returning();
  }
  res.json(serialize(row));
});

export default router;
