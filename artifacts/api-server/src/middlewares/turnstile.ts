import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8000;

// Off until Camila creates the widget in the Cloudflare dashboard and sets
// TURNSTILE_SECRET_KEY on Render — same "unset means not enforced yet"
// convention as EXTRA_TRUSTED_ORIGINS in lib/auth.ts. Once the secret is
// set, verification turns on with no further code change.
export async function verifyTurnstile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    next();
    return;
  }

  const token = req.headers["x-turnstile-token"];
  if (typeof token !== "string" || !token) {
    res.status(403).json({ message: "Verificación humana requerida." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({ secret: secretKey, response: token });
    if (req.ip) params.set("remoteip", req.ip);

    const verifyResponse = await fetch(VERIFY_URL, {
      method: "POST",
      body: params,
      signal: controller.signal,
    });
    const result = (await verifyResponse.json()) as { success: boolean; "error-codes"?: string[] };

    if (!result.success) {
      logger.warn({ errorCodes: result["error-codes"] }, "Verificación de Turnstile rechazada");
      res.status(403).json({ message: "Verificación humana fallida. Intenta de nuevo." });
      return;
    }
    next();
  } catch (err) {
    logger.warn({ err }, "No se pudo verificar el token de Turnstile");
    res.status(503).json({ message: "No se pudo verificar la solicitud. Intenta de nuevo." });
  } finally {
    clearTimeout(timeout);
  }
}
