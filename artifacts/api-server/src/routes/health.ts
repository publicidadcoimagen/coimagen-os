import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

// Render sets RENDER=true on every service running on its infra; that's a
// real signal of "this is the deployed portal" independent of whether
// NODE_ENV was ever manually configured.
export function getEnvironment(env: NodeJS.ProcessEnv): "production" | "development" {
  return env.RENDER === "true" || env.NODE_ENV === "production" ? "production" : "development";
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
  const environment = getEnvironment(process.env);
  const providers = {
    anthropic: hasEnv("ANTHROPIC_API_KEY"),
    gemini: hasEnv("GEMINI_API_KEY"),
    deepseek: hasEnv("DEEPSEEK_API_KEY"),
    resend: hasEnv("RESEND_API_KEY"),
  };
  const data = HealthCheckResponse.parse({ status, environment, providers });
  res.status(dbOk ? 200 : 503).json(data);
});

export default router;
