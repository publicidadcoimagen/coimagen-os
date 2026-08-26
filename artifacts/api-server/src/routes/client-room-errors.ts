import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { getLastAlertSentAt, recordAlertSent, cooldownActive, recordCrashIncident } from "../lib/client-room-error-alert/repository";
import { sendClientRoomCrashAlertEmail } from "../lib/client-room-error-alert/email";

const router: IRouter = Router();

// Every field is attacker-controlled (any authenticated role, including
// cliente — see below), so this isn't just "reject malformed JSON": the
// length caps stop a compromised/buggy account from writing multi-MB blobs
// into incidents.logs on every request, well inside the 5mb express.json()
// body limit that would otherwise let that through silently.
const ReportErrorBody = z.object({
  slug: z.string().min(1).max(200),
  path: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  stack: z.string().max(20_000).optional(),
  componentStack: z.string().max(20_000).optional(),
  userAgent: z.string().max(500).optional(),
});

// Keyed by user id (populated by the global authMiddleware ahead of this
// router, before requireAuth even runs) rather than IP: the threat model
// here is one compromised/buggy *account* hammering this endpoint, not a
// generic anonymous flood — IP would under-count a shared office/proxy IP
// and over-count nothing, so per-user is the tighter, more correct key.
// 10/5min is generous for genuine distinct crashes across several pages in
// one session, but a hard stop on a retry loop or intentional spam.
const reportErrorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user as { id?: string } | undefined)?.id ?? req.ip ?? "unknown",
  message: { error: "Demasiados reportes de error. Intenta de nuevo más tarde." },
});

// Fired by ClientRoomErrorBoundary the moment a render crash reaches it —
// any authenticated role, since a cliente-role account is exactly who hits
// this. Not requireRole(ceo, admin): that would 403 the very report we need
// from a real client's crashed session.
router.post("/client-room/report-error", reportErrorLimiter, requireAuth, async (req, res): Promise<void> => {
  const body = ReportErrorBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const user = req.user as { id: string; email: string | null; role?: string; clientId?: number | null };

  const report = {
    slug: d.slug,
    path: d.path,
    message: d.message,
    stack: d.stack,
    componentStack: d.componentStack,
    userAgent: d.userAgent,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role ?? "viewer",
    clientId: user.clientId ?? null,
  };

  const incidentId = await recordCrashIncident(report);

  const now = new Date();
  const lastSentAt = await getLastAlertSentAt();
  if (!cooldownActive(lastSentAt, now)) {
    await recordAlertSent(now);
    try {
      await sendClientRoomCrashAlertEmail(report, incidentId);
    } catch (err) {
      logger.error({ err, incidentId }, "No se pudo enviar la alerta de Client Room caído");
    }
  }

  res.status(201).json({ incidentId });
});

export default router;
