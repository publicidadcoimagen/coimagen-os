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
  { method: "GET", pattern: /^\/projects$/ },
  { method: "GET", pattern: /^\/projects\/\d+$/ },
  { method: "GET", pattern: /^\/contracts$/ },
  { method: "GET", pattern: /^\/contracts\/\d+$/ },
  { method: "PATCH", pattern: /^\/contracts\/\d+$/ },
  { method: "GET", pattern: /^\/invoices$/ },
  { method: "GET", pattern: /^\/invoices\/\d+$/ },
  { method: "GET", pattern: /^\/client-approvals$/ },
  { method: "GET", pattern: /^\/client-approvals\/\d+$/ },
  { method: "POST", pattern: /^\/client-approvals$/ },
  { method: "PATCH", pattern: /^\/client-approvals\/\d+$/ },
  { method: "GET", pattern: /^\/clients\/\d+\/onboarding$/ },
  { method: "GET", pattern: /^\/account(\/|$)/ },
  { method: "POST", pattern: /^\/account(\/|$)/ },
  // Becky Beck catalog ("ecommerce" module, P-79) — becky-beck.ts itself
  // further gates these behind the caller's client having "ecommerce"
  // enabled, so listing them here doesn't open the catalog to every
  // cliente account, only to route-class reachability.
  { method: "GET", pattern: /^\/becky-beck\/products$/ },
  { method: "POST", pattern: /^\/becky-beck\/products$/ },
  { method: "PATCH", pattern: /^\/becky-beck\/products\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/becky-beck\/products\/[^/]+$/ },
];

export function clientRoleGate(req: Request, res: Response, next: NextFunction): void {
  if (!isClienteRole(req)) { next(); return; }
  const allowed = CLIENT_ALLOWED.some((r) => r.method === req.method && r.pattern.test(req.path));
  if (!allowed) { res.status(403).json({ error: "Not available for this account" }); return; }
  next();
}
