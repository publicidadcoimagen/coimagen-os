import { type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, or } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";
import { logger } from "../lib/logger";

// DocuSeal (self-hosted elsewhere) calls this on submission lifecycle
// events, signed via a plain HMAC-SHA256 over the raw body (not Svix like
// Resend) — see docs.docuseal.com/webhooks. Needs the exact raw request
// bytes to verify, so this route is mounted in app.ts with express.raw()
// ahead of the global express.json() — same reasoning as webhooks-resend.ts.
interface DocusealWebhookPayload {
  event_type?: string;
  data?: {
    id?: number | string;
    external_id?: string | null;
    completed_at?: string | null;
    combined_document_url?: string | null;
    audit_log_url?: string | null;
    submitters?: Array<{ email?: string | null; ip?: string | null; role?: string | null }>;
  };
}

function verifySignature(rawBody: Buffer, secret: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  // Different lengths would throw inside timingSafeEqual instead of just
  // comparing false — a malformed/forged header must reject cleanly.
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

// The signer who actually completed the submission — DocuSeal lists every
// submitter, but a contract only has one signer today. First submitter with
// a completed-looking record is close enough; there's exactly one per
// submission in Coimagen's use of DocuSeal.
function firstSubmitter(data: DocusealWebhookPayload["data"]) {
  return data?.submitters?.[0];
}

async function handleSubmissionCompleted(payload: DocusealWebhookPayload): Promise<void> {
  const data = payload.data;
  if (!data) return;

  const submissionId = data.id != null ? String(data.id) : null;
  const externalId = data.external_id ?? null;

  // Look up by the DocuSeal submission id first (set on a prior webhook for
  // this same submission, if any), falling back to external_id — the value
  // we set to contracts.id at submission-create time — for the very first
  // webhook delivery, before docusealSubmissionId has ever been stored.
  const conditions = [];
  if (submissionId) conditions.push(eq(contractsTable.docusealSubmissionId, submissionId));
  if (externalId) conditions.push(eq(contractsTable.docusealExternalId, externalId));
  if (conditions.length === 0) {
    logger.warn({ payload }, "Webhook de DocuSeal sin id de submission ni external_id — no se pudo asociar a un contrato");
    return;
  }

  const [contract] = await db.select().from(contractsTable).where(or(...conditions));
  if (!contract) {
    logger.warn({ submissionId, externalId }, "Webhook de DocuSeal para un contrato que no reconocemos — ignorado");
    return;
  }

  if (contract.status === "signed") return; // already processed — the dedup guard

  const submitter = firstSubmitter(data);

  await db.update(contractsTable).set({
    status: "signed",
    signedAt: data.completed_at ? new Date(data.completed_at) : new Date(),
    signedBy: submitter?.email ?? null,
    signedDocumentUrl: data.combined_document_url ?? null,
    auditLogUrl: data.audit_log_url ?? null,
    signerIp: submitter?.ip ?? null,
    docusealSubmissionId: contract.docusealSubmissionId ?? submissionId,
    updatedAt: new Date(),
  }).where(eq(contractsTable.id, contract.id));

  logger.info({ contractId: contract.id, submissionId }, "Contrato firmado vía DocuSeal — evidencia registrada");
}

// Public, unauthenticated at the Express level — protected instead by
// DocuSeal's HMAC signature (X-Docuseal-Signature over the raw body).
// Fails closed when unconfigured, same as Jotform/PayPal: an unverified
// caller here could forge a "contract signed" event, which is exactly the
// legal gap this integration exists to close.
export async function docusealWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("DOCUSEAL_WEBHOOK_SECRET no está configurada — webhook de DocuSeal rechazado");
    res.status(503).json({ error: "Webhook no configurado" });
    return;
  }

  const rawBody = req.body as Buffer;
  const signature = req.headers["x-docuseal-signature"] as string | undefined;
  if (!verifySignature(rawBody, secret, signature)) {
    logger.warn("Firma de webhook de DocuSeal inválida — solicitud rechazada");
    res.status(400).json({ error: "Firma inválida" });
    return;
  }

  let payload: DocusealWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as DocusealWebhookPayload;
  } catch {
    res.status(400).json({ error: "JSON inválido" });
    return;
  }

  try {
    switch (payload.event_type) {
      case "submission.completed":
        await handleSubmissionCompleted(payload);
        break;
      default:
        // Unhandled event types are expected — DocuSeal sends more than we
        // act on today (form.viewed, form.started, submission.expired...).
        // Acknowledge, don't 400/500.
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: payload.event_type }, "Error procesando webhook de DocuSeal");
    res.status(500).json({ error: "Error interno" });
    return;
  }

  res.status(200).json({ received: true });
}
