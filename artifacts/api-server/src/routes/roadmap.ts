import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, roadmapItemsTable } from "@workspace/db";
import { CreateRoadmapItemBody, UpdateRoadmapItemBody, UpdateRoadmapItemParams, DeleteRoadmapItemParams } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/roadmap", async (req, res): Promise<void> => {
  const items = await db.select().from(roadmapItemsTable).orderBy(roadmapItemsTable.createdAt);
  res.json(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt?.toISOString() ?? null })));
});

router.post("/roadmap", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateRoadmapItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(roadmapItemsTable).values({
    version: parsed.data.version,
    objective: parsed.data.objective,
    status: parsed.data.status ?? "planned",
    priority: parsed.data.priority ?? "medium",
    estimatedDate: parsed.data.estimatedDate ?? null,
    dependencies: parsed.data.dependencies ?? null,
    deliverables: parsed.data.deliverables ?? null,
    risks: parsed.data.risks ?? null,
  }).returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.patch("/roadmap/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateRoadmapItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateRoadmapItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(roadmapItemsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(roadmapItemsTable.id, params.data.id))
    .returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.delete("/roadmap/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteRoadmapItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(roadmapItemsTable).where(eq(roadmapItemsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
