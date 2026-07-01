import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  CreateAuditLogBody,
  ListAuditLogsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const fmt = (a: typeof auditLogsTable.$inferSelect) => ({
  ...a,
  createdAt: a.createdAt.toISOString(),
});

router.get("/audit-logs", async (req, res): Promise<void> => {
  const qp = ListAuditLogsQueryParams.safeParse(req.query);
  let rows = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} DESC`);
  if (qp.success && qp.data.module) rows = rows.filter((r) => r.module === qp.data.module);
  if (qp.success && qp.data.status) rows = rows.filter((r) => r.status === qp.data.status);
  const limit = (qp.success && qp.data.limit) ? qp.data.limit : 200;
  res.json(rows.slice(0, limit).map(fmt));
});

router.post("/audit-logs", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateAuditLogBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(auditLogsTable).values({
    userId: parsed.data.userId ?? null,
    module: parsed.data.module,
    action: parsed.data.action,
    result: parsed.data.result ?? null,
    status: parsed.data.status ?? "success",
    metadata: parsed.data.metadata ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

export default router;
