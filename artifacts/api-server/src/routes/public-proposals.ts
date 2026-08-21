import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, proposalsTable, invoicesTable, type Proposal } from "@workspace/db";
import { GetPublicProposalParams, ApprovePublicProposalParams } from "@workspace/api-zod";
import { createInstallmentInvoices } from "../lib/payment-schedule/repository";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function findActiveInvoice(proposalId: number) {
  const [invoice] = await db.select().from(invoicesTable)
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
async function findPaymentSchedule(proposalId: number) {
  const rows = await db.select().from(invoicesTable)
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

async function serializePublicView(p: Proposal) {
  const activeInvoice = p.status === "accepted" ? await findActiveInvoice(p.id) : null;
  const paymentSchedule = p.status === "accepted" ? await findPaymentSchedule(p.id) : [];
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

  res.json(await serializePublicView(proposal));
});

// Public, unauthenticated. Idempotent-ish: approving an already-accepted
// proposal just returns its current state rather than erroring, but a
// rejected proposal can't be flipped to accepted from this endpoint — that
// needs staff intervention (PATCH /proposals/:id), not a public POST.
//
// P-payments: the FIRST time a proposal is accepted, this also generates
// the payment-schedule invoices (createInstallmentInvoices) so the client
// can pay the deposit right away, inline on this same page. If invoice
// generation fails (e.g. proposal has no clientId/amount — staff never
// finished setting it up), the approval itself still succeeds; only
// nextInvoice stays null and it's logged for staff to fix and retry.
router.post("/public/proposals/:token/approve", async (req, res): Promise<void> => {
  const parsed = ApprovePublicProposalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.publicToken, parsed.data.token)).limit(1);
  if (!proposal) {
    res.status(404).json({ error: "Propuesta no encontrada" });
    return;
  }

  if (proposal.status === "rejected") {
    res.status(409).json({ error: "Esta propuesta ya fue rechazada — contacta a Coimagen para actualizarla." });
    return;
  }

  if (proposal.status === "accepted") {
    res.json(await serializePublicView(proposal));
    return;
  }

  const [updated] = await db.update(proposalsTable).set({ status: "accepted", updatedAt: new Date() })
    .where(eq(proposalsTable.id, proposal.id)).returning();

  try {
    await createInstallmentInvoices(updated);
  } catch (err) {
    logger.warn({ err, proposalId: updated.id }, "No se pudieron generar las cuotas al aprobar la propuesta — revisar clientId/amount");
  }

  res.json(await serializePublicView(updated));
});

export default router;
