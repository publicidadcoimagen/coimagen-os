# COIMAGEN OS

Sistema Operativo Interno de Coimagen Media Agency (CEO: Camila Segovia).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/coimagen-os run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages (0 errors goal)
- `pnpm run typecheck:libs` — typecheck libs only (run before leaf packages)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `SESSION_SECRET` — Express session secret; `REPL_ID`, `ISSUER_URL` — Replit Auth OIDC

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, base path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit Auth (OpenID Connect, PKCE, PostgreSQL sessions via `openid-client` v6)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (includes auth.ts for sessions/users)
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-zod/` — generated Zod schemas (don't edit manually)
- `lib/api-client-react/` — generated TanStack Query hooks (don't edit manually)
- `lib/replit-auth-web/` — `useAuth()` hook for the frontend
- `artifacts/api-server/src/` — Express server (routes, middlewares, lib)
- `artifacts/coimagen-os/src/` — React frontend

## Architecture decisions

- Contract-first: edit `openapi.yaml` → run codegen → use generated hooks. No Zod in new route files — use generated schemas.
- Replit Auth protects all `/api/*` routes except `/api/healthz`, `/api/auth/*`, `/api/login`, `/api/callback`, `/api/logout`.
- Roles: `ceo`, `admin`, `viewer` stored in `users.role` (default: `viewer`). Use `requireRole()` middleware for protected mutations.
- FK constraints: cascade delete for client-owned data; set null for agent/prospect references.
- Audit middleware auto-logs all 2xx POST/PATCH/DELETE to `audit_logs` table.

## Product

Internal agency OS with: client management, projects, tasks, commercial pipeline (prospects, diagnoses, proposals), approvals, finance (invoices, subscriptions, revenue/costs), AI agents management, audit trail, and coming-soon features.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm run typecheck` (lib declarations must be built first).
- After editing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` — it also rebuilds libs.
- Do NOT use `console.log` in server code — use `req.log` in route handlers or `logger` singleton for non-request code.
- The `/// <reference types="vite/client" />` directive is in `lib/replit-auth-web/src/use-auth.ts` so the lib can use `import.meta.env`.
- Generated hook signatures: `useListX(params, options)` — pass `{}` as first arg when there are no query/path params but you need to set `options.query`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `replit-auth` skill for auth setup details
