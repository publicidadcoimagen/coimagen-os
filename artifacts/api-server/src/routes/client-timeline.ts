import { Router, type IRouter } from "express";
import { db, clientTimelineTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const rows = await db.select().from(clientTimelineTable)
    .where(eq(clientTimelineTable.clientId, clientId))
    .orderBy(desc(clientTimelineTable.occurredAt));
  res.json(rows.map(r => ({
    ...r,
    occurredAt: r.occurredAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const { title, eventType, description, occurredAt } = req.body as Record<string, string>;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [row] = await db.insert(clientTimelineTable).values({
    clientId,
    title,
    eventType: eventType ?? "note",
    description: description || undefined,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
  }).returning();
  res.status(201).json({
    ...row,
    occurredAt: row!.occurredAt.toISOString(),
    createdAt: row!.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(clientTimelineTable).where(eq(clientTimelineTable.id, id));
  res.json({ success: true });
});

export default router;
