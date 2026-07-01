import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bugsTable } from "@workspace/db";
import { CreateBugBody, UpdateBugBody, UpdateBugParams, DeleteBugParams } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/bugs", async (req, res): Promise<void> => {
  const bugs = await db.select().from(bugsTable).orderBy(bugsTable.createdAt);
  res.json(bugs.map((b) => ({ ...b, createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt?.toISOString() ?? null })));
});

router.post("/bugs", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateBugBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [bug] = await db.insert(bugsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    severity: parsed.data.severity ?? "medium",
    status: parsed.data.status ?? "new",
    module: parsed.data.module ?? null,
    detectedAt: parsed.data.detectedAt ?? null,
    resolvedAt: parsed.data.resolvedAt ?? null,
    assignee: parsed.data.assignee ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json({ ...bug, createdAt: bug.createdAt.toISOString(), updatedAt: bug.updatedAt?.toISOString() ?? null });
});

router.patch("/bugs/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateBugParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateBugBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [bug] = await db.update(bugsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bugsTable.id, params.data.id))
    .returning();
  if (!bug) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...bug, createdAt: bug.createdAt.toISOString(), updatedAt: bug.updatedAt?.toISOString() ?? null });
});

router.delete("/bugs/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteBugParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(bugsTable).where(eq(bugsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
