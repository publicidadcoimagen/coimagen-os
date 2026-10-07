// Permanent pro-bono accounts (clients.access_gate_exempt): never billed,
// never restricted for non-payment. Only the CEO may grant or revoke it —
// it removes a client from billing entirely — and every change is audited.

export type ProBonoDecision =
  | { allowed: true; changed: boolean }
  | { allowed: false };

// `requested` undefined means the request doesn't touch the flag at all.
export function proBonoChange(role: string | undefined, current: boolean, requested: boolean | undefined): ProBonoDecision {
  if (requested === undefined) return { allowed: true, changed: false };
  if (role !== "ceo") return { allowed: false };
  return { allowed: true, changed: requested !== current };
}
