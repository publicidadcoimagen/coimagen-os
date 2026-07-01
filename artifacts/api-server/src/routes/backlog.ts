import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, backlogItemsTable } from "@workspace/db";
import { CreateBacklogItemBody, UpdateBacklogItemBody, UpdateBacklogItemParams, DeleteBacklogItemParams, GetBacklogItemParams } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/backlog", async (req, res): Promise<void> => {
  const items = await db.select().from(backlogItemsTable).orderBy(backlogItemsTable.createdAt);
  res.json(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt?.toISOString() ?? null })));
});

router.post("/backlog", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateBacklogItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(backlogItemsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    epic: parsed.data.epic ?? null,
    priority: parsed.data.priority ?? "medium",
    assignee: parsed.data.assignee ?? null,
    sprint: parsed.data.sprint ?? null,
    status: parsed.data.status ?? "backlog",
    dueDate: parsed.data.dueDate ?? null,
    checklist: parsed.data.checklist ?? null,
    notes: parsed.data.notes ?? null,
    clientId: parsed.data.clientId ?? null,
    projectId: parsed.data.projectId ?? null,
    agentId: parsed.data.agentId ?? null,
  }).returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.get("/backlog/:id", async (req, res): Promise<void> => {
  const params = GetBacklogItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [item] = await db.select().from(backlogItemsTable).where(eq(backlogItemsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.patch("/backlog/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateBacklogItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateBacklogItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(backlogItemsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(backlogItemsTable.id, params.data.id))
    .returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.delete("/backlog/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteBacklogItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(backlogItemsTable).where(eq(backlogItemsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
