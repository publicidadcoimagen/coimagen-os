import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { getLastAlertSentAt, recordAlertSent, cooldownActive, recordCrashIncident } from "../lib/client-room-error-alert/repository";
import { sendClientRoomCrashAlertEmail } from "../lib/client-room-error-alert/email";

const router: IRouter = Router();

const ReportErrorBody = z.object({
  slug: z.string().min(1),
  path: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  userAgent: z.string().optional(),
});

// Fired by ClientRoomErrorBoundary the moment a render crash reaches it —
// any authenticated role, since a cliente-role account is exactly who hits
// this. Not requireRole(ceo, admin): that would 403 the very report we need
// from a real client's crashed session.
router.post("/client-room/report-error", requireAuth, async (req, res): Promise<void> => {
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
