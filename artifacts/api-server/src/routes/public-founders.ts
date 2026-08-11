import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { MAX_FOUNDERS } from "./clients";

const router: IRouter = Router();

// Public, unauthenticated by design — powers the live "X of 20 founders"
// counter on coimagenmedia.com. Exposes only a count and the fixed max,
// nothing client-identifying.
router.get("/public/founders/count", async (_req, res): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientsTable)
    .where(eq(clientsTable.isFounder, true));

  res.json({ count, max: MAX_FOUNDERS });
});

export default router;
