import { type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getAccessGateState, createOrGetAccessGateTicket, formatTicketCode } from "../lib/access-gate/repository";

// Server-to-server only — Content Intelligence is, today, the one caller.
// Public, unauthenticated at the Express level like the Jotform/PayPal
// webhooks, protected instead by a shared secret header checked inline.
// Fails CLOSED when unconfigured (same reasoning as Jotform's webhook): an
// open access-gate status/ticket endpoint is a real abuse vector, not a
// convenience worth risking.
function checkGateApiKey(req: Request, res: Response): boolean {
  const key = process.env.ACCESS_GATE_API_KEY;
  if (!key) {
    logger.error("ACCESS_GATE_API_KEY no está configurada — endpoint de access-gate rechazado");
    res.status(503).json({ error: "Endpoint no configurado" });
    return false;
  }
  if (req.headers["x-gate-api-key"] !== key) {
    logger.warn("X-Gate-Api-Key inválida — solicitud de access-gate rechazada");
    res.status(401).json({ error: "No autorizado" });
    return false;
  }
  return true;
}

// GET /api/internal/access-gate/status/:clientId
export async function accessGateStatusHandler(req: Request, res: Response): Promise<void> {
  if (!checkGateApiKey(req, res)) return;

  const clientId = Number(req.params.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    res.status(400).json({ error: "clientId inválido" });
    return;
  }

  const state = await getAccessGateState(clientId);
  if (!state) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  res.json({
    clientId,
    access: state.access,
    causeCode: state.causeCode,
    since: state.since ? state.since.toISOString() : null,
  });
}

interface CreateTicketBody {
  clientId?: unknown;
  causeCode?: unknown;
  blockedAction?: unknown;
  source?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// POST /api/internal/access-gate/tickets
// Idempotency-Key header is REQUIRED, not optional — without it there is no
// dedupe boundary, and a flaky connection on Content Intelligence's side
// (their own documented retry-on-5xx behavior) would mint a fresh folio per
// retry instead of returning the one the client already saw.
export async function accessGateTicketHandler(req: Request, res: Response): Promise<void> {
  if (!checkGateApiKey(req, res)) return;

  const idempotencyKey = req.headers["idempotency-key"];
  if (!isNonEmptyString(idempotencyKey)) {
    res.status(400).json({ error: "Falta el header Idempotency-Key" });
    return;
  }

  const body = req.body as CreateTicketBody;
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    res.status(400).json({ error: "clientId inválido" });
    return;
  }
  if (!isNonEmptyString(body.causeCode)) {
    res.status(400).json({ error: "Falta causeCode" });
    return;
  }
  if (!isNonEmptyString(body.source)) {
    res.status(400).json({ error: "Falta source" });
    return;
  }

  const state = await getAccessGateState(clientId);
  if (!state) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const ticket = await createOrGetAccessGateTicket({
    clientId,
    causeCode: body.causeCode,
    blockedAction: isNonEmptyString(body.blockedAction) ? body.blockedAction : null,
    source: body.source,
    idempotencyKey,
  });

  res.status(ticket.deduped ? 200 : 201).json({
    ticketId: formatTicketCode(ticket.id, ticket.createdAt),
    clientId: ticket.clientId,
    causeCode: ticket.causeCode,
    createdAt: ticket.createdAt.toISOString(),
    deduped: ticket.deduped,
  });
}
