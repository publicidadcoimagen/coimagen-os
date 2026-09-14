import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import {
  CreateOrganizationBody,
  GetOrganizationParams,
  UpdateOrganizationParams,
  UpdateOrganizationBody,
  DeleteOrganizationParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { isClienteRole, ownOrgIds, ownsClientId } from "../middlewares/clientScope";

const router: IRouter = Router();

function serialize(r: typeof organizationsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/organizations", async (req, res): Promise<void> => {
  if (isClienteRole(req)) {
    const ids = (await ownOrgIds(req)) ?? [];
    if (ids.length === 0) { res.json([]); return; }
    const rows = await db.select().from(organizationsTable).where(inArray(organizationsTable.id, ids)).orderBy(desc(organizationsTable.createdAt));
    res.json(rows.map(serialize));
    return;
  }
  const rows = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/organizations", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
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
    language: d.language ?? "es",
  }).returning();

  res.status(201).json(serialize(row));
});

router.get("/organizations/:slug", async (req, res): Promise<void> => {
  const params = GetOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  const [row] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, params.data.slug));
  if (!row || !ownsClientId(req, row.clientId)) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

// Staff (ceo/admin) may edit any field on any organization. A cliente-role
// caller may edit only their own organization (clientRoleGate only grants
// route-class reachability, same as onboarding/brand), and only the safe
// display fields the Client Room's own "Editar perfil" dialog exposes —
// never slug/clientId/logoUrl/language, regardless of what the request body
// contains, since those can re-point or rename the org's own Client Room URL
// or hand it to a different client entirely. Previously this route was
// requireRole("ceo","admin")-only, so a real cliente account's "Editar"
// button always failed with 403 (found in the 2026-09-14 integration audit).
router.patch("/organizations/:slug", async (req, res): Promise<void> => {
  const params = UpdateOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }

  const [existing] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, params.data.slug));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const role = (req.user as { role?: string } | undefined)?.role ?? "viewer";
  const isStaffManager = role === "ceo" || role === "admin";
  const isOwnClienteCaller = isClienteRole(req) && ownsClientId(req, existing.clientId);
  if (!isStaffManager && !isOwnClienteCaller) { res.status(403).json({ error: "Not available for this account" }); return; }

  const body = UpdateOrganizationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.contactEmail !== undefined) update.contactEmail = d.contactEmail;
  if (d.contactPhone !== undefined) update.contactPhone = d.contactPhone;
  if (d.primaryColor !== undefined) update.primaryColor = d.primaryColor;
  if (isStaffManager) {
    if (d.slug !== undefined) update.slug = d.slug;
    if (d.clientId !== undefined) update.clientId = d.clientId;
    if (d.logoUrl !== undefined) update.logoUrl = d.logoUrl;
    if (d.language !== undefined) update.language = d.language;
  }

  const finalSlug = isStaffManager && d.slug !== undefined ? d.slug : params.data.slug;
  await db.update(organizationsTable).set(update).where(eq(organizationsTable.slug, params.data.slug));
  const [updated] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, finalSlug));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/organizations/:slug", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  await db.delete(organizationsTable).where(eq(organizationsTable.slug, params.data.slug));
  res.sendStatus(204);
});

export default router;
