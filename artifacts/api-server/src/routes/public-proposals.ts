import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, proposalsTable } from "@workspace/db";
import { GetPublicProposalParams, ApprovePublicProposalParams } from "@workspace/api-zod";

const router: IRouter = Router();

function serializePublicView(p: typeof proposalsTable.$inferSelect) {
  return {
    title: p.title,
    status: p.status,
    amount: p.amount !== null ? parseFloat(p.amount) : null,
    notes: p.notes,
    validUntil: p.validUntil,
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

  res.json(serializePublicView(proposal));
});

// Public, unauthenticated. Idempotent-ish: approving an already-accepted
// proposal just returns its current state rather than erroring, but a
// rejected proposal can't be flipped to accepted from this endpoint — that
// needs staff intervention (PATCH /proposals/:id), not a public POST.
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
    res.json(serializePublicView(proposal));
    return;
  }

  const [updated] = await db.update(proposalsTable).set({ status: "accepted", updatedAt: new Date() })
    .where(eq(proposalsTable.id, proposal.id)).returning();
  res.json(serializePublicView(updated));
});

export default router;
