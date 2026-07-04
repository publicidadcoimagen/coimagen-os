import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
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
  const limit = (qp.success && qp.data.limit) ? qp.data.limit : 200;
  let query = db.select().from(auditLogsTable).$dynamic();
  const conditions = [];
  if (qp.success && qp.data.module) conditions.push(eq(auditLogsTable.module, qp.data.module));
  if (qp.success && qp.data.status) conditions.push(eq(auditLogsTable.status, qp.data.status));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(sql`${auditLogsTable.createdAt} DESC`).limit(limit);
  res.json(rows.map(fmt));
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
