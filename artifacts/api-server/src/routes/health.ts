import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

router.get("/healthz", async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const status = dbOk ? "ok" : "degraded";
  const providers = {
    anthropic: hasEnv("ANTHROPIC_API_KEY"),
    gemini: hasEnv("GEMINI_API_KEY"),
    deepseek: hasEnv("DEEPSEEK_API_KEY"),
    resend: hasEnv("RESEND_API_KEY"),
  };
  const data = HealthCheckResponse.parse({ status, providers });
  res.status(dbOk ? 200 : 503).json(data);
});

export default router;
