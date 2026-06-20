import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientBrandTable } from "@workspace/db";

const router: IRouter = Router();

const serializeBrand = (r: typeof clientBrandTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
});

router.get("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const [row] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeBrand(row));
});

router.put("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
  const body = req.body;
  const [existing] = await db.select().from(clientBrandTable).where(eq(clientBrandTable.clientId, clientId));
  const values = {
    clientId,
    logoUrl: body.logoUrl ?? null,
    brandColors: body.brandColors ?? null,
    fonts: body.fonts ?? null,
    brandNotes: body.brandNotes ?? null,
    websiteUrl: body.websiteUrl ?? null,
    facebookUrl: body.facebookUrl ?? null,
    instagramUrl: body.instagramUrl ?? null,
    googleBusinessUrl: body.googleBusinessUrl ?? null,
    youtubeUrl: body.youtubeUrl ?? null,
    updatedAt: new Date(),
  };
  let row;
  if (existing) {
    [row] = await db.update(clientBrandTable).set(values).where(eq(clientBrandTable.clientId, clientId)).returning();
  } else {
    [row] = await db.insert(clientBrandTable).values(values).returning();
  }
  res.json(serializeBrand(row));
});

export default router;
