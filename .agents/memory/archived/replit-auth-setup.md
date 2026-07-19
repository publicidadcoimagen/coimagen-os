---
name: Replit Auth setup for COIMAGEN OS (ARCHIVED — superseded)
description: "ARCHIVED 2026-07-19: this OIDC/Replit Auth setup was fully replaced by Better Auth (email + password). Kept for historical context only — do not follow these instructions."
---

> **Archivado.** Todo lo descrito acá (Replit Auth, OIDC, `/api/login`,
> `/api/callback`, `/api/logout`, `REPL_ID`/`ISSUER_URL`) fue reemplazado
> por Better Auth (email + contraseña) durante la migración de auth.
> Ver `artifacts/api-server/src/lib/auth.ts` y
> `lib/replit-auth-web/src/use-auth.ts` para el setup actual. Se conserva
> este archivo solo como referencia histórica.

Auth is fully integrated (V1.5 Security Hardening).

**DB tables:** `sessions` (sid, sess, expire) and `users` (id, email, firstName, lastName, profileImageUrl, role varchar default 'viewer') in `lib/db/src/schema/auth.ts`.

**Role column:** Added `role: varchar("role").notNull().default("viewer")` to usersTable (not in the template — added manually). Include `role: dbUser.role` in SessionData user object in both browser and mobile auth flows in `routes/auth.ts`.

**Backend middleware order in routes/index.ts:**
1. `auditMiddleware` (before all routes — logs 2xx mutations)
2. `healthRouter` (public)
3. `authRouter` (public — /auth/user, /login, /callback, /logout)
4. `requireAuth` (protects everything below)
5. All other routers

**requireRole middleware:** `requireRole('ceo', 'admin')` — use for write operations that viewers shouldn't access.

**Frontend:** `useAuth()` from `@workspace/replit-auth-web` in App.tsx AuthGate. Shows login screen if not authenticated; redirects to `/api/login?returnTo=<BASE_URL>`.

**vite/client types:** `lib/replit-auth-web` needs `vite: "catalog:"` in devDependencies and `"types": ["vite/client"]` in tsconfig so `import.meta.env.BASE_URL` compiles in the lib context.

**Why:** Needed role on AuthUser type (added to OpenAPI schema as required field). The template didn't include it — must be added to both SessionData construction points in auth.ts.
