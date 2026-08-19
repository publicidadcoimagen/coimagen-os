import { Router, type IRouter } from "express";
import { SubmitProspectingAuditReviewParams, SubmitProspectingAuditReviewBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { listPendingProspectingAudits, submitManualReview } from "../lib/prospecting-audits/repository";

const router: IRouter = Router();

// Staff-only (P-82 Agente Prospectador) — the manual-review queue for the 2
// checklist items with no reliable API (abandoned social media, no content
// published). Same requireRole("ceo", "admin") gate used for the equivalent
// staff-only actions in contracts.ts.
router.get("/prospecting-audits/pending", requireRole("ceo", "admin"), async (_req, res): Promise<void> => {
  const rows = await listPendingProspectingAudits();
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.patch("/prospecting-audits/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = SubmitProspectingAuditReviewParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = SubmitProspectingAuditReviewBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const result = await submitManualReview(params.data.id, body.data);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result);
});

export default router;
