// The reviewer of an approval is whoever is logged in — never a value the
// request body supplies. The UI used to send reviewedBy: "Camila Segovia" on
// every decision, so any admin's approval was recorded as the CEO's, and any
// caller could write an arbitrary name. Pure and unit-tested.

export type SessionUser = { id: string; name?: string | null; email?: string | null };

export function actorLabel(user: SessionUser): string {
  return user.name || user.email || user.id;
}

const DECIDED = new Set(["approved", "rejected"]);

// PATCH: drop any body-supplied reviewedBy; a status change records the
// session user as reviewer.
export function approvalUpdate<T extends { status?: string; reviewedBy?: unknown }>(body: T, actor: string) {
  const { reviewedBy: _ignored, ...rest } = body;
  return rest.status !== undefined ? { ...rest, reviewedBy: actor } : rest;
}

// POST: an approval created already decided was reviewed by its creator;
// one created as draft/pending has no reviewer yet.
export function reviewerOnCreate(status: string | undefined, actor: string): string | null {
  return status !== undefined && DECIDED.has(status) ? actor : null;
}
