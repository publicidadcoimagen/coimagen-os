import { eq, and } from "drizzle-orm";
import { db, diagnosesTable, prospectsTable } from "@workspace/db";
import {
  type ProspectingChecklist,
  type ProspectTier,
  EMPTY_CHECKLIST,
  isPendingManualReview,
  computeScore,
  classifyTier,
} from "./scoring";

// diagnosesTable.type value for a P-82 Agente Prospectador audit (as
// opposed to the existing "digital_diagnosis" self-submitted flow). Rows of
// this type are created by the audit agent itself (Google Places/PageSpeed
// calls + HTML analysis) — not built in this phase, see scoring.ts. This
// module only reads/updates rows that already exist.
export const PROSPECTING_AUDIT_TYPE = "prospecting_audit";
// diagnosesTable.status values for this flow: pending_review until a staff
// member answers the 2 manual-only checklist items, reviewed afterward.
export const PENDING_REVIEW_STATUS = "pending_review";
export const REVIEWED_STATUS = "reviewed";

export interface PendingProspectingAudit {
  diagnosisId: number;
  prospectId: number;
  prospectName: string;
  prospectPhone: string | null;
  prospectIndustry: string | null;
  checklist: ProspectingChecklist;
  createdAt: Date;
}

// diagnoses.result is an untyped jsonb column shared with the unrelated
// "digital_diagnosis" flow's own shape — this is the one place that assumes
// a `checklist` sub-object exists (P-82's own convention), and always
// backfills any missing/malformed key with null rather than trusting the
// stored shape.
function extractChecklist(result: Record<string, unknown> | null): ProspectingChecklist {
  const stored = (result?.checklist ?? {}) as Partial<ProspectingChecklist>;
  return { ...EMPTY_CHECKLIST, ...stored };
}

// Every prospecting_audit diagnosis still missing one or both of the 2
// manual-only checklist answers (see scoring.ts's MANUAL_REVIEW_KEYS) — the
// actual work queue a staff member needs to clear. Filters on
// status = pending_review first (cheap, indexable) then re-checks
// isPendingManualReview in application code as the source of truth, so a
// row can never show as "pending" once both answers are in, or vice versa.
// Inner-joined to prospects for display fields only (name/phone/industry) —
// a prospecting_audit diagnosis is only ever created with a real prospectId
// (see module comment above), so an orphaned row here would indicate a bug
// upstream, not a valid state to render.
export async function listPendingProspectingAudits(): Promise<PendingProspectingAudit[]> {
  const rows = await db
    .select({
      diagnosisId: diagnosesTable.id,
      result: diagnosesTable.result,
      createdAt: diagnosesTable.createdAt,
      prospectId: prospectsTable.id,
      prospectName: prospectsTable.name,
      prospectPhone: prospectsTable.phone,
      prospectIndustry: prospectsTable.industry,
    })
    .from(diagnosesTable)
    .innerJoin(prospectsTable, eq(prospectsTable.id, diagnosesTable.prospectId))
    .where(and(eq(diagnosesTable.type, PROSPECTING_AUDIT_TYPE), eq(diagnosesTable.status, PENDING_REVIEW_STATUS)));

  return rows
    .map((row) => ({
      diagnosisId: row.diagnosisId,
      prospectId: row.prospectId,
      prospectName: row.prospectName,
      prospectPhone: row.prospectPhone,
      prospectIndustry: row.prospectIndustry,
      checklist: extractChecklist(row.result),
      createdAt: row.createdAt,
    }))
    .filter((row) => isPendingManualReview(row.checklist));
}

export interface SubmittedReview {
  diagnosisId: number;
  status: string;
  score: number;
  tier: ProspectTier;
  checklist: ProspectingChecklist;
}

// Records the 2 manual answers, computes the final score/tier off the full
// 10-item checklist (any of the 8 auto keys still null just doesn't count
// toward the score — see computeScore), and flips
// status pending_review → reviewed. Returns null if there's no such
// diagnosis, it isn't a prospecting_audit, or it's already been reviewed —
// the route turns that into a 404 rather than silently re-scoring a
// finalized audit.
export async function submitManualReview(
  diagnosisId: number,
  answers: { abandonedSocial: boolean; noContentPublished: boolean },
): Promise<SubmittedReview | null> {
  const [existing] = await db.select().from(diagnosesTable).where(eq(diagnosesTable.id, diagnosisId));
  if (!existing || existing.type !== PROSPECTING_AUDIT_TYPE || existing.status !== PENDING_REVIEW_STATUS) return null;

  const checklist: ProspectingChecklist = {
    ...extractChecklist(existing.result),
    abandonedSocial: answers.abandonedSocial,
    noContentPublished: answers.noContentPublished,
  };
  const score = computeScore(checklist);
  const tier = classifyTier(score);
  const result = { ...(existing.result ?? {}), checklist, score, tier };

  await db.update(diagnosesTable)
    .set({ result, status: REVIEWED_STATUS, updatedAt: new Date() })
    .where(eq(diagnosesTable.id, diagnosisId));

  return { diagnosisId, status: REVIEWED_STATUS, score, tier, checklist };
}
