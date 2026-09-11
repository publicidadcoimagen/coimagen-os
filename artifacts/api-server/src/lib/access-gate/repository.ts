import { eq, sql } from "drizzle-orm";
import { db, clientsTable, subscriptionsTable, accessGateTicketsTable } from "@workspace/db";
import { evaluateAccessGate, type AccessGateState } from "./evaluate";

export async function getAccessGateState(clientId: number): Promise<AccessGateState | null> {
  const [client] = await db.select({ accessGateExempt: clientsTable.accessGateExempt })
    .from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return null; // no such client — caller returns 404

  // A client can carry more than one historical subscription row (e.g. an
  // old manually-created one alongside a newer proposal-driven one) — only
  // the most recently touched one reflects the client's current billing
  // reality; an old cancelled/past_due row sitting behind a live active one
  // must never resurrect a restriction that no longer applies.
  const [mostRecent] = await db.select({
    status: subscriptionsTable.status,
    updatedAt: subscriptionsTable.updatedAt,
    createdAt: subscriptionsTable.createdAt,
  }).from(subscriptionsTable)
    .where(eq(subscriptionsTable.clientId, clientId))
    // A never-updated row (updatedAt still null) must sort by its
    // createdAt, not jump to the front of a DESC sort ahead of rows that
    // really were touched more recently — Postgres's default NULLS FIRST
    // on DESC would otherwise treat "never touched" as "most recent".
    .orderBy(sql`coalesce(${subscriptionsTable.updatedAt}, ${subscriptionsTable.createdAt}) DESC`)
    .limit(1);

  return evaluateAccessGate(client.accessGateExempt, mostRecent ?? null);
}

export interface CreateTicketInput {
  clientId: number;
  causeCode: string;
  blockedAction: string | null;
  source: string;
  idempotencyKey: string;
}

export interface AccessGateTicketResult {
  id: number;
  clientId: number;
  causeCode: string;
  createdAt: Date;
  deduped: boolean;
}

// Idempotent on idempotencyKey (unique constraint on
// access_gate_tickets.idempotency_key is the real safety net, same pattern
// as every other alert/reminder table in this codebase) — a caller that
// retries after a timeout, or a client who trips the gate five times in one
// day, gets back the SAME folio instead of a fresh one each time.
export async function createOrGetAccessGateTicket(input: CreateTicketInput): Promise<AccessGateTicketResult> {
  const existing = await findTicketByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  try {
    const [row] = await db.insert(accessGateTicketsTable).values({
      clientId: input.clientId,
      causeCode: input.causeCode,
      blockedAction: input.blockedAction,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
    }).returning();

    return { id: row.id, clientId: row.clientId, causeCode: row.causeCode, createdAt: row.createdAt, deduped: false };
  } catch (err) {
    // Two concurrent blocked attempts (e.g. two open tabs) racing the same
    // idempotency key: the SELECT above missed each other, but the unique
    // constraint on idempotency_key can only let one INSERT through. The
    // loser re-reads instead of surfacing a 500 — a caller-visible error
    // here would just trigger ChatiCode's 5xx retry for no reason.
    if ((err as { code?: string }).code === "23505") {
      const winner = await findTicketByIdempotencyKey(input.idempotencyKey);
      if (winner) return winner;
    }
    throw err;
  }
}

async function findTicketByIdempotencyKey(idempotencyKey: string): Promise<AccessGateTicketResult | null> {
  const [existing] = await db.select().from(accessGateTicketsTable)
    .where(eq(accessGateTicketsTable.idempotencyKey, idempotencyKey));
  if (!existing) return null;
  return { id: existing.id, clientId: existing.clientId, causeCode: existing.causeCode, createdAt: existing.createdAt, deduped: true };
}

// Folio shown to the client ("GATE-2026-00193") — derived from id +
// createdAt rather than stored, so there's no second column to keep in
// sync and no race between "insert the row" and "mint the code".
export function formatTicketCode(id: number, createdAt: Date): string {
  return `GATE-${createdAt.getUTCFullYear()}-${String(id).padStart(5, "0")}`;
}
