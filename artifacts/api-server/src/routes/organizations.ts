import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import {
  CreateOrganizationBody,
  GetOrganizationParams,
  UpdateOrganizationParams,
  UpdateOrganizationBody,
  DeleteOrganizationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(r: typeof organizationsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/organizations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/organizations", async (req, res): Promise<void> => {
  const body = CreateOrganizationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const existing = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, d.slug));
  if (existing.length > 0) { res.status(409).json({ error: "Slug already in use" }); return; }

  const [row] = await db.insert(organizationsTable).values({
    slug: d.slug,
    name: d.name,
    description: d.description ?? null,
    clientId: d.clientId ?? null,
    logoUrl: d.logoUrl ?? null,
    primaryColor: d.primaryColor ?? null,
    contactEmail: d.contactEmail ?? null,
    contactPhone: d.contactPhone ?? null,
  }).returning();

  res.status(201).json(serialize(row));
});

router.get("/organizations/:slug", async (req, res): Promise<void> => {
  const params = GetOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  const [row] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, params.data.slug));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

router.patch("/organizations/:slug", async (req, res): Promise<void> => {
  const params = UpdateOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  const body = UpdateOrganizationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.slug !== undefined) update.slug = d.slug;
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.logoUrl !== undefined) update.logoUrl = d.logoUrl;
  if (d.primaryColor !== undefined) update.primaryColor = d.primaryColor;
  if (d.contactEmail !== undefined) update.contactEmail = d.contactEmail;
  if (d.contactPhone !== undefined) update.contactPhone = d.contactPhone;

  await db.update(organizationsTable).set(update).where(eq(organizationsTable.slug, params.data.slug));
  const [updated] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, d.slug ?? params.data.slug));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/organizations/:slug", async (req, res): Promise<void> => {
  const params = DeleteOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  await db.delete(organizationsTable).where(eq(organizationsTable.slug, params.data.slug));
  res.sendStatus(204);
});

export default router;
