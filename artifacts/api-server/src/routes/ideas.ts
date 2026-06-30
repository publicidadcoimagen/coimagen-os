import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ideasTable } from "@workspace/db";
import { CreateIdeaBody, UpdateIdeaBody, UpdateIdeaParams, DeleteIdeaParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ideas", async (req, res): Promise<void> => {
  const ideas = await db.select().from(ideasTable).orderBy(ideasTable.createdAt);
  res.json(ideas.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt?.toISOString() ?? null })));
});

router.post("/ideas", async (req, res): Promise<void> => {
  const parsed = CreateIdeaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [idea] = await db.insert(ideasTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    area: parsed.data.area ?? null,
    impact: parsed.data.impact ?? null,
    complexity: parsed.data.complexity ?? null,
    status: parsed.data.status ?? "new",
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json({ ...idea, createdAt: idea.createdAt.toISOString(), updatedAt: idea.updatedAt?.toISOString() ?? null });
});

router.patch("/ideas/:id", async (req, res): Promise<void> => {
  const params = UpdateIdeaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateIdeaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [idea] = await db.update(ideasTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(ideasTable.id, params.data.id))
    .returning();
  if (!idea) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...idea, createdAt: idea.createdAt.toISOString(), updatedAt: idea.updatedAt?.toISOString() ?? null });
});

router.delete("/ideas/:id", async (req, res): Promise<void> => {
  const params = DeleteIdeaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(ideasTable).where(eq(ideasTable.id, params.data.id));
  res.status(204).send();
});

export default router;
