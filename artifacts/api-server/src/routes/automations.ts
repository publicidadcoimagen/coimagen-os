import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, automationsTable } from "@workspace/db";
import { CreateAutomationBody, UpdateAutomationBody, UpdateAutomationParams, DeleteAutomationParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/automations", async (req, res): Promise<void> => {
  const items = await db.select().from(automationsTable).orderBy(automationsTable.createdAt);
  res.json(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt?.toISOString() ?? null })));
});

router.post("/automations", async (req, res): Promise<void> => {
  const parsed = CreateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(automationsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    platform: parsed.data.platform ?? null,
    status: parsed.data.status ?? "active",
    trigger: parsed.data.trigger ?? null,
    action: parsed.data.action ?? null,
    clientId: parsed.data.clientId ?? null,
    projectId: parsed.data.projectId ?? null,
    agentId: parsed.data.agentId ?? null,
    lastRun: parsed.data.lastRun ?? null,
    result: parsed.data.result ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.patch("/automations/:id", async (req, res): Promise<void> => {
  const params = UpdateAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(automationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(automationsTable.id, params.data.id))
    .returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null });
});

router.delete("/automations/:id", async (req, res): Promise<void> => {
  const params = DeleteAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(automationsTable).where(eq(automationsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
