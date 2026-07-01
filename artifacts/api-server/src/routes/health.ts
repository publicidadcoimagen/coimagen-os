import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const status = dbOk ? "ok" : "degraded";
  const data = HealthCheckResponse.parse({ status });
  res.status(dbOk ? 200 : 503).json(data);
});

export default router;
