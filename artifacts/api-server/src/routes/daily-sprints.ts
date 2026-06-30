import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dailySprintsTable } from "@workspace/db";
import { CreateDailySprintBody, UpdateDailySprintBody, UpdateDailySprintParams, DeleteDailySprintParams, GetDailySprintParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/daily-sprints", async (req, res): Promise<void> => {
  const sprints = await db.select().from(dailySprintsTable).orderBy(dailySprintsTable.createdAt);
  res.json(sprints.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt?.toISOString() ?? null })));
});

router.post("/daily-sprints", async (req, res): Promise<void> => {
  const parsed = CreateDailySprintBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sprint] = await db.insert(dailySprintsTable).values({
    date: parsed.data.date,
    objective: parsed.data.objective ?? null,
    doneYesterday: parsed.data.doneYesterday ?? null,
    replitWorking: parsed.data.replitWorking ?? null,
    todayPlan: parsed.data.todayPlan ?? null,
    blockers: parsed.data.blockers ?? null,
    deliverables: parsed.data.deliverables ?? null,
    result: parsed.data.result ?? null,
    tomorrowPending: parsed.data.tomorrowPending ?? null,
    status: parsed.data.status ?? "active",
  }).returning();
  res.status(201).json({ ...sprint, createdAt: sprint.createdAt.toISOString(), updatedAt: sprint.updatedAt?.toISOString() ?? null });
});

router.get("/daily-sprints/:id", async (req, res): Promise<void> => {
  const params = GetDailySprintParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [sprint] = await db.select().from(dailySprintsTable).where(eq(dailySprintsTable.id, params.data.id));
  if (!sprint) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...sprint, createdAt: sprint.createdAt.toISOString(), updatedAt: sprint.updatedAt?.toISOString() ?? null });
});

router.patch("/daily-sprints/:id", async (req, res): Promise<void> => {
  const params = UpdateDailySprintParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateDailySprintBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sprint] = await db.update(dailySprintsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(dailySprintsTable.id, params.data.id))
    .returning();
  if (!sprint) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...sprint, createdAt: sprint.createdAt.toISOString(), updatedAt: sprint.updatedAt?.toISOString() ?? null });
});

router.delete("/daily-sprints/:id", async (req, res): Promise<void> => {
  const params = DeleteDailySprintParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(dailySprintsTable).where(eq(dailySprintsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
