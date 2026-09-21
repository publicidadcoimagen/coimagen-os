import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, proposalsTable, invoicesTable, type Proposal, type Invoice } from "@workspace/db";
import { GetPublicProposalParams, ApprovePublicProposalParams } from "@workspace/api-zod";
import { createInstallmentInvoices } from "../lib/payment-schedule/repository";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Shape every DB-touching helper below needs — narrow enough that a PGlite
// test instance satisfies it too (same injectable-dbClient pattern as
// prospect-conversion/repository.ts's convertProspectToClient and
// payment-schedule/repository.ts's createInstallmentInvoices). Defaults to
// the real singleton for every production caller; the route handlers below
// never pass a second argument.
type DbClient = Pick<typeof db, "select" | "update">;

async function findActiveInvoice(proposalId: number, dbClient: DbClient) {
  const [invoice] = await dbClient.select().from(invoicesTable)
    .where(and(eq(invoicesTable.proposalId, proposalId), eq(invoicesTable.status, "sent")))
    .limit(1);
  return invoice ?? null;
}

// Pendiente #6a — every installment generated for this proposal, not just
// the one currently payable, so the client can see their whole payment
// plan from the same public page. Read-only: this endpoint already existed
// and was already public (same token, same scope) — this only adds more of
// what it returns, no new access surface, per the agreed design ("vista
// previa en la misma página", not a new session/token type).
async function findPaymentSchedule(proposalId: number, dbClient: DbClient) {
  const rows: Invoice[] = await dbClient.select().from(invoicesTable)
    .where(eq(invoicesTable.proposalId, proposalId))
    .orderBy(invoicesTable.id);
  return rows.map((invoice) => ({
    label: invoice.installmentLabel ?? invoice.description ?? "Pago",
    amount: parseFloat(invoice.amount),
    currency: invoice.currency,
    status: invoice.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
    publicToken: invoice.publicToken,
  }));
}

async function serializePublicView(p: Proposal, dbClient: DbClient) {
  const activeInvoice = p.status === "accepted" ? await findActiveInvoice(p.id, dbClient) : null;
  const paymentSchedule = p.status === "accepted" ? await findPaymentSchedule(p.id, dbClient) : [];
  return {
    title: p.title,
    status: p.status,
    amount: p.amount !== null ? parseFloat(p.amount) : null,
    notes: p.notes,
    validUntil: p.validUntil,
    nextInvoice: activeInvoice
      ? {
          publicToken: activeInvoice.publicToken!,
          label: activeInvoice.installmentLabel ?? activeInvoice.description ?? "Pago",
          amount: parseFloat(activeInvoice.amount),
          currency: activeInvoice.currency,
          status: activeInvoice.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
          subscriptionApproveUrl: null, // only ever set on the LAST installment, see webhooks-paypal.ts
          subscriptionPending: false, // ditto — only relevant once the deposit/milestone invoices are all paid
        }
      : null,
    paymentSchedule,
  };
}

// Public, unauthenticated — powers correo 3/4's link (P-81 Fase A). Looked
// up by an opaque UUID token rather than the sequential proposals.id, same
// reasoning as the digital-diagnosis results page: a prospect's terms
// shouldn't be browsable by guessing consecutive ids.
router.get("/public/proposals/:token", async (req, res): Promise<void> => {
  const parsed = GetPublicProposalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.publicToken, parsed.data.token)).limit(1);
  if (!proposal) {
    res.status(404).json({ error: "Propuesta no encontrada" });
    return;
  }

  res.json(await serializePublicView(proposal, db));
});

// Extracted so the DB-touching approve path (previously only exercised by
// the param-validation-only test in public-proposals.test.ts — the actual
// accept/create-invoices path had no coverage) can be tested against a real
// embedded Postgres (PGlite), same as prospect-conversion.test.ts. This is
// exactly the path that shipped without invoices.publicToken until the
// createInstallmentInvoices fix — see test/public-proposals-approve.test.ts.
//
// Idempotent-ish: approving an already-accepted proposal just returns its
// current state rather than erroring, but a rejected proposal can't be
// flipped to accepted from here — that needs staff intervention
// (PATCH /proposals/:id), not a public POST.
//
// P-payments: the FIRST time a proposal is accepted, this also generates
// the payment-schedule invoices (createInstallmentInvoices) so the client
// can pay the deposit right away, inline on this same page. If invoice
// generation fails (e.g. proposal has no clientId/amount — staff never
// finished setting it up), the approval itself still succeeds; only
// nextInvoice stays null and it's logged for staff to fix and retry.
export async function approveProposalByToken(
  token: string,
  dbClient: DbClient & Pick<typeof db, "insert"> = db,
): Promise<{ status: number; body: unknown }> {
  const [proposal] = await dbClient.select().from(proposalsTable).where(eq(proposalsTable.publicToken, token)).limit(1);
  if (!proposal) {
    return { status: 404, body: { error: "Propuesta no encontrada" } };
  }

  if (proposal.status === "rejected") {
    return { status: 409, body: { error: "Esta propuesta ya fue rechazada — contacta a Coimagen para actualizarla." } };
  }

  if (proposal.status === "accepted") {
    return { status: 200, body: await serializePublicView(proposal, dbClient) };
  }

  const [updated] = await dbClient.update(proposalsTable).set({ status: "accepted", updatedAt: new Date() })
    .where(eq(proposalsTable.id, proposal.id)).returning();

  try {
    await createInstallmentInvoices(updated, dbClient);
  } catch (err) {
    logger.warn({ err, proposalId: updated.id }, "No se pudieron generar las cuotas al aprobar la propuesta — revisar clientId/amount");
  }

  return { status: 200, body: await serializePublicView(updated, dbClient) };
}

router.post("/public/proposals/:token/approve", async (req, res): Promise<void> => {
  const parsed = ApprovePublicProposalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, body } = await approveProposalByToken(parsed.data.token);
  res.status(status).json(body);
});

export default router;
