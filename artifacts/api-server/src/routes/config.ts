import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, configTable } from "@workspace/db";
import { UpsertConfigBody } from "@workspace/api-zod";

const router: IRouter = Router();

const fmt = (c: typeof configTable.$inferSelect) => ({
  ...c,
  updatedAt: c.updatedAt.toISOString(),
});

router.get("/config", async (req, res): Promise<void> => {
  const rows = await db.select().from(configTable).orderBy(configTable.key);
  res.json(rows.map(fmt));
});

router.get("/config/:key", async (req, res): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const [row] = await db.select().from(configTable).where(eq(configTable.key, key));
  if (!row) { res.status(404).json({ error: "Config key not found" }); return; }
  res.json(fmt(row));
});

router.put("/config/:key", async (req, res): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const parsed = UpsertConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(configTable).values({ key, value: parsed.data.value }).onConflictDoUpdate({
    target: configTable.key,
    set: { value: parsed.data.value, updatedAt: new Date() },
  }).returning();
  res.json(fmt(row));
});

export default router;
