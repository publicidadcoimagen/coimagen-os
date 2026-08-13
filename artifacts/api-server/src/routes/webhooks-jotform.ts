import { type Request, type Response } from "express";
import { eq, or } from "drizzle-orm";
import { db, prospectsTable } from "@workspace/db";
import { logger } from "../lib/logger";

// Jotform's AI Agent (the assistant answering WhatsApp/Facebook for the
// funnel) has a "Send API Request" action that can POST conversation data
// to a URL of our choosing — this is that URL. The payload shape below is
// OUR contract, configured on Jotform's side (Camila maps their fields to
// these names in the Agent Builder), not something Jotform imposes.
interface JotformLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  // "jotform_whatsapp" | "jotform_facebook" | etc — whatever channel this
  // particular action fires from. Free text, not an enum, same as every
  // other prospects.source value in this codebase.
  channel?: string;
  summary?: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// Public, unauthenticated at the Express level — protected instead by a
// shared secret header, since Jotform's action config can't do HMAC signing
// the way Resend/Svix does. Unlike Turnstile (P-81), this fails CLOSED when
// unconfigured: an open endpoint that writes prospects to the CRM is a real
// abuse vector, whereas a login form without Turnstile is still behind a
// password.
export async function jotformWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.JOTFORM_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("JOTFORM_WEBHOOK_SECRET no está configurada — webhook de Jotform rechazado");
    res.status(503).json({ error: "Webhook no configurado" });
    return;
  }

  if (req.headers["x-jotform-webhook-secret"] !== secret) {
    logger.warn("Secreto de webhook de Jotform inválido — solicitud rechazada");
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const payload = req.body as JotformLeadPayload;
  const name = isNonEmptyString(payload.name) ? payload.name.trim() : null;
  const phone = isNonEmptyString(payload.phone) ? payload.phone.trim() : null;
  const email = isNonEmptyString(payload.email) ? payload.email.trim() : null;
  const channel = isNonEmptyString(payload.channel) ? payload.channel.trim() : "jotform_whatsapp";

  // Phone is the one identifier this channel reliably has — WhatsApp/
  // Facebook conversations don't always collect an email. Without at least
  // one of the two there's nothing to dedupe on or contact later.
  if (!phone && !email) {
    res.status(400).json({ error: "Se requiere al menos teléfono o correo" });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "Se requiere el nombre" });
    return;
  }

  const matchConditions = [];
  if (email) matchConditions.push(eq(prospectsTable.email, email));
  if (phone) matchConditions.push(eq(prospectsTable.phone, phone));
  const [existing] = await db.select().from(prospectsTable).where(or(...matchConditions)).limit(1);

  const notes = isNonEmptyString(payload.summary) ? payload.summary.trim() : null;

  const [prospect] = existing
    ? await db.update(prospectsTable).set({
        name,
        phone: phone ?? existing.phone,
        email: email ?? existing.email,
        source: channel,
        notes: notes ?? existing.notes,
        updatedAt: new Date(),
      }).where(eq(prospectsTable.id, existing.id)).returning()
    : await db.insert(prospectsTable).values({
        name,
        phone,
        email,
        source: channel,
        status: "lead",
        notes,
      }).returning();

  logger.info({ prospectId: prospect.id, channel, hadEmail: !!email }, "Prospecto registrado desde el asistente de Jotform");

  // No P-80 auto-followup on purpose (Camila's call, P-81): these leads are
  // recorded, not yet enrolled — findDueFollowups only ever matches
  // source === "diagnostico_digital" for the null-clientId (Coimagen) case,
  // so a "jotform_*" source is naturally excluded without extra code here.
  res.status(201).json({ prospectId: prospect.id });
}
