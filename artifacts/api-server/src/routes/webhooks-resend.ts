import { type Request, type Response } from "express";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db, diagnosesTable, emailEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

// Resend signs webhook requests via Svix (see
// resend.com/docs/dashboard/webhooks/verify-webhooks-requests). Verification
// needs the exact raw request bytes, so this route is mounted in app.ts with
// express.raw() ahead of the global express.json() — by the time a request
// reaches any other route, express.json() has already consumed the body.
interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
  };
}

// Only events we act on today — accepted (not yet meaningful on its own),
// delivered, bounced, complained. Anything else Resend adds later is still
// recorded (see the catch-all below) since eventType is a free-text column,
// not an enum — just without special-casing here.
function firstRecipient(to: string | string[] | undefined): string | undefined {
  if (!to) return undefined;
  return Array.isArray(to) ? to[0] : to;
}

export async function resendWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("RESEND_WEBHOOK_SECRET no está configurada — no se puede verificar el webhook de Resend");
    res.status(500).json({ error: "Webhook no configurado" });
    return;
  }

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];

  let payload: ResendWebhookPayload;
  try {
    const wh = new Webhook(secret);
    // req.body is a Buffer here (express.raw), which is exactly what Svix
    // needs — verify() rejects if it's been parsed/re-stringified already.
    payload = wh.verify(req.body, {
      "svix-id": svixId as string,
      "svix-timestamp": svixTimestamp as string,
      "svix-signature": svixSignature as string,
    }) as ResendWebhookPayload;
  } catch (err) {
    logger.warn({ err }, "Firma de webhook de Resend inválida — solicitud rechazada");
    res.status(400).json({ error: "Firma inválida" });
    return;
  }

  const emailId = payload.data?.email_id;
  const recipient = firstRecipient(payload.data?.to);

  let diagnosisId: number | null = null;
  if (emailId) {
    const [diagnosis] = await db
      .select({ id: diagnosesTable.id })
      .from(diagnosesTable)
      .where(eq(diagnosesTable.leadEmailId, emailId))
      .limit(1);
    diagnosisId = diagnosis?.id ?? null;
  }

  await db.insert(emailEventsTable).values({
    provider: "resend",
    eventType: payload.type,
    emailId: emailId ?? "(sin email_id)",
    recipient,
    diagnosisId,
    payload: payload as unknown as Record<string, unknown>,
    occurredAt: payload.created_at ? new Date(payload.created_at) : null,
  });

  logger.info({ eventType: payload.type, emailId, diagnosisId }, "Evento de webhook de Resend registrado");

  res.status(200).json({ received: true });
}
