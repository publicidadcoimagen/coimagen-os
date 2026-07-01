import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientOnboardingTable } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const serialize = (r: typeof clientOnboardingTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
});

router.get("/clients/:clientId/onboarding", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
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

export default router;
