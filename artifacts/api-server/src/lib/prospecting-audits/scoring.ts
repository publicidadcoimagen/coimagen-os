// Pure checklist/scoring logic for P-82 Agente Prospectador — no DB, no
// network, unit-testable in isolation (mirrors commercial-followup/
// eligibility.ts's split between pure logic and the DB-touching
// repository.ts).
//
// The 10-item digital-presence checklist. 8 of these are meant to be
// auto-checked in a later phase (Google Places/PageSpeed APIs + HTML
// analysis — not built yet, no API keys contracted). The remaining 2
// (abandonedSocial, noContentPublished) have no reliable API and are always
// filled in by a human staff member via the manual-review queue (see
// repository.ts) — a prospect's score/tier is only final once both are
// answered. Each value is `true` (checklist item confirmed present, i.e. a
// real gap in the business's digital presence), `false` (checked, not
// present), or `null` (not yet checked).
export interface ProspectingChecklist {
  noWebsite: boolean | null;
  oldWebsite: boolean | null;
  slowWebsite: boolean | null;
  noGoogleBusiness: boolean | null;
  incompleteGoogleBusiness: boolean | null;
  noVisibleWhatsapp: boolean | null;
  abandonedSocial: boolean | null;
  noContentPublished: boolean | null;
  noAutomation: boolean | null;
  noLeadCapture: boolean | null;
}

export const CHECKLIST_KEYS: readonly (keyof ProspectingChecklist)[] = [
  "noWebsite",
  "oldWebsite",
  "slowWebsite",
  "noGoogleBusiness",
  "incompleteGoogleBusiness",
  "noVisibleWhatsapp",
  "abandonedSocial",
  "noContentPublished",
  "noAutomation",
  "noLeadCapture",
];

// The 2 items with no reliable API — see module comment above.
export const MANUAL_REVIEW_KEYS: readonly (keyof ProspectingChecklist)[] = [
  "abandonedSocial",
  "noContentPublished",
];

export const EMPTY_CHECKLIST: ProspectingChecklist = {
  noWebsite: null,
  oldWebsite: null,
  slowWebsite: null,
  noGoogleBusiness: null,
  incompleteGoogleBusiness: null,
  noVisibleWhatsapp: null,
  abandonedSocial: null,
  noContentPublished: null,
  noAutomation: null,
  noLeadCapture: null,
};

// True until both manual-only keys have been answered (non-null) — this is
// exactly the condition that puts a prospecting audit in the pending-review
// queue, regardless of how many of the 8 auto-checkable keys are still null
// (those aren't built yet, so today every row is pending on that basis too).
export function isPendingManualReview(checklist: ProspectingChecklist): boolean {
  return MANUAL_REVIEW_KEYS.some((key) => checklist[key] == null);
}

export type ProspectTier = "A" | "B" | "C" | "D";

// Score = count of checklist items that are `true` (i.e. count of confirmed
// digital-presence gaps) across all 10 keys. A `null` (not yet checked) does
// NOT count as true — callers should only compute this once
// isPendingManualReview is false, so in practice the 8 auto keys must also
// already be resolved one way or the other for the score to be meaningful;
// this function itself makes no such assumption and just counts `true`s.
export function computeScore(checklist: ProspectingChecklist): number {
  return CHECKLIST_KEYS.reduce((count, key) => count + (checklist[key] === true ? 1 : 0), 0);
}

// Thresholds (0-2=D, 3-5=C, 6-8=B, 9-10=A): higher score means more
// confirmed gaps in the business's digital presence, i.e. more opportunity
// for Coimagen's services — so tier A is the *highest-priority* prospect to
// contact, not the "healthiest" one. Simple 4-bucket split chosen for a
// first pass; revisit once real outreach data shows which tier actually
// converts.
export function classifyTier(score: number): ProspectTier {
  if (score >= 9) return "A";
  if (score >= 6) return "B";
  if (score >= 3) return "C";
  return "D";
}
