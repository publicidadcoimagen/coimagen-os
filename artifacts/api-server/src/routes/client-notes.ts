import { Router, type IRouter } from "express";
import { db, clientNotesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const rows = await db.select().from(clientNotesTable)
    .where(eq(clientNotesTable.clientId, clientId))
    .orderBy(desc(clientNotesTable.pinned), desc(clientNotesTable.updatedAt));
  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  })));
});

router.post("/", async (req, res): Promise<void> => {
  const clientId = parseInt((req.params as Record<string, string>).clientId);
  const body = req.body as Record<string, unknown>;
  const title = body.title;
  if (!title || typeof title !== "string") { res.status(400).json({ error: "title required" }); return; }
  const [row] = await db.insert(clientNotesTable).values({
    clientId,
    title,
    category: typeof body.category === "string" ? body.category : "general",
    content: typeof body.content === "string" ? body.content : undefined,
    pinned: typeof body.pinned === "boolean" ? body.pinned : false,
  }).returning();
  res.status(201).json({
    ...row,
    createdAt: row!.createdAt.toISOString(),
    updatedAt: row!.updatedAt?.toISOString() ?? null,
  });
});

router.patch("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const body = req.body as Record<string, unknown>;
  const vals: Partial<typeof clientNotesTable.$inferInsert & { updatedAt: Date }> = { updatedAt: new Date() };
  if (typeof body.title === "string") vals.title = body.title;
  if (typeof body.category === "string") vals.category = body.category;
  if (typeof body.content === "string") vals.content = body.content;
  if (typeof body.pinned === "boolean") vals.pinned = body.pinned;
  const [row] = await db.update(clientNotesTable).set(vals).where(eq(clientNotesTable.id, id)).returning();
  res.json({
    ...row,
    createdAt: row!.createdAt.toISOString(),
    updatedAt: row!.updatedAt?.toISOString() ?? null,
  });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(clientNotesTable).where(eq(clientNotesTable.id, id));
  res.json({ success: true });
});

export default router;
