import type { Request, Response, NextFunction } from "express";
import { isClienteRole } from "./clientScope";

// role="cliente" accounts are the client-room: they must default to seeing
// NOTHING on the internal API surface, with only the specific endpoints the
// Portal module matrix (P-79) needs explicitly allowed. This is a default-
// deny gate rather than a per-route audit — the internal API has 40+ route
// files (clients, costs, revenue, agents, prospects, audit-logs, mundos,
// directors, etc.) and enumerating every one to block would only be as
// strong as the last file anyone remembered to touch. New internal routes
// added later are safe by default; only routes added here become reachable
// by a cliente account.
const CLIENT_ALLOWED: { method: string; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/organizations$/ },
  { method: "GET", pattern: /^\/organizations\/[^/]+$/ },
  // Client Room "Editar perfil" (profile.tsx) — scoped to the caller's own
  // organization and a safe field subset inside the handler itself
  // (ownsClientId + isStaffManager), same pattern as onboarding/brand below;
  // this allowlist entry only grants route-class reachability. Previously
  // missing here, so the button always failed with 403 for a real client
  // account (2026-09-14 integration audit).
  { method: "PATCH", pattern: /^\/organizations\/[^/]+$/ },
  { method: "GET", pattern: /^\/projects$/ },
  { method: "GET", pattern: /^\/projects\/\d+$/ },
  { method: "GET", pattern: /^\/contracts$/ },
  { method: "GET", pattern: /^\/contracts\/\d+$/ },
  // Fresh signed-PDF/audit URLs for the embedded viewer — same own-clientId
  // scoping as GET /contracts/:id, enforced inside the handler.
  { method: "GET", pattern: /^\/contracts\/\d+\/signed-documents$/ },
  { method: "PATCH", pattern: /^\/contracts\/\d+$/ },
  { method: "GET", pattern: /^\/invoices$/ },
  { method: "GET", pattern: /^\/invoices\/\d+$/ },
  { method: "GET", pattern: /^\/client-approvals$/ },
  { method: "GET", pattern: /^\/client-approvals\/\d+$/ },
  { method: "POST", pattern: /^\/client-approvals$/ },
  { method: "PATCH", pattern: /^\/client-approvals\/\d+$/ },
  { method: "GET", pattern: /^\/clients\/\d+\/onboarding$/ },
  // Client self-service onboarding wizard (Fase C) — PATCH is scoped to the
  // caller's own clientId inside the route handler itself (ownsClientId);
  // this allowlist entry only grants route-class reachability.
  { method: "PATCH", pattern: /^\/clients\/\d+\/onboarding$/ },
  // Client self-service brand content-capture (Fase C, extends the
  // onboarding wizard) — GET/PATCH both scoped via ownsClientId inside the
  // handlers; this allowlist entry only grants route-class reachability.
  { method: "GET", pattern: /^\/clients\/\d+\/brand$/ },
  { method: "PATCH", pattern: /^\/clients\/\d+\/brand$/ },
  { method: "GET", pattern: /^\/clients\/\d+\/brand\/logo$/ },
  { method: "PATCH", pattern: /^\/clients\/\d+\/brand\/logo$/ },
  { method: "GET", pattern: /^\/account(\/|$)/ },
  { method: "POST", pattern: /^\/account(\/|$)/ },
  // Client-facing workflow progress widget — scoped to the caller's own
  // clientId inside the route handler (ownsClientId), returns only
  // currentStage/status/updatedAt, never the internal-only fields (notes,
  // blockers, responsibleId, agentIds) that GET /workflows/:id exposes.
  { method: "GET", pattern: /^\/clients\/\d+\/workflow$/ },
  // Product catalog ("ecommerce" module, P-79/pendiente #5) — catalog.ts
  // itself further gates these behind the caller's client having
  // "ecommerce" enabled, so listing them here doesn't open the catalog to
  // every cliente account, only to route-class reachability.
  { method: "GET", pattern: /^\/products$/ },
  { method: "POST", pattern: /^\/products$/ },
  { method: "GET", pattern: /^\/products\/[^/]+$/ },
  { method: "PATCH", pattern: /^\/products\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/products\/[^/]+$/ },
  { method: "GET", pattern: /^\/products\/[^/]+\/images\/\d+$/ },
  // Orders — read-only for cliente accounts (fulfillment stays
  // staff-only-in-practice, see catalog.ts's own comment on that route;
  // leaving /orders/:id/fulfill off this allowlist means the gate itself
  // blocks it for cliente accounts too, not just the UI's own omission).
  { method: "GET", pattern: /^\/orders$/ },
  { method: "GET", pattern: /^\/orders\/\d+$/ },
  // Becky Beck's original P-77 catalog (Netlify Functions + Blobs) — see
  // becky-beck-legacy.ts. Writes are further scoped to Becky's own
  // clientId inside that route (not just "ecommerce" enabled), so listing
  // them here doesn't open her catalog to any other cliente account.
  { method: "GET", pattern: /^\/becky-beck-legacy\/products$/ },
  { method: "POST", pattern: /^\/becky-beck-legacy\/products$/ },
  { method: "GET", pattern: /^\/becky-beck-legacy\/products\/[^/]+\/image$/ },
  { method: "PATCH", pattern: /^\/becky-beck-legacy\/products\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/becky-beck-legacy\/products\/[^/]+$/ },
  // Client Room crash reporting (PR #38/#39) — a cliente-role account is
  // exactly who fires this when their own Client Room crashes; this gate
  // was blocking it entirely (missing from this list), so no real client
  // crash ever reached the rate limiter, the incident log, or the staff
  // alert email. requireAuth + the per-user rate limiter still apply.
  { method: "POST", pattern: /^\/client-room\/report-error$/ },
];

export function clientRoleGate(req: Request, res: Response, next: NextFunction): void {
  if (!isClienteRole(req)) { next(); return; }
  const allowed = CLIENT_ALLOWED.some((r) => r.method === req.method && r.pattern.test(req.path));
  if (!allowed) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
}
