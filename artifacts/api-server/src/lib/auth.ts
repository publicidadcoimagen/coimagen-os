import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "@workspace/db";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function isFirstUser(): Promise<boolean> {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  return existing.length === 0;
}

export const auth = betterAuth({
  secret: process.env.SESSION_SECRET ?? "coimagen-default-secret-key-!!",
  baseURL: process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? "8080"}`,
  basePath: "/api/auth",
  // The dashboard (artifacts/coimagen-os) is deployed as a separate origin
  // from this API. Its production URL isn't known until it's actually
  // deployed (Fase 5) — set DASHBOARD_URL then and redeploy, no code change
  // needed. Unset means no cross-origin dashboard requests are trusted yet.
  //
  // EXTRA_TRUSTED_ORIGINS: comma-separated exact origins, for temporarily
  // trusting a specific Vercel preview URL while testing a branch against
  // this same backend. Unset by default — must never hold a wildcard
  // (e.g. "https://*.vercel.app"): cookies are sameSite:"none", so any
  // origin listed here can ride the session cross-site, and vercel.app is
  // a public multi-tenant domain anyone can deploy to. Set it on Render
  // only for the duration of a manual preview test, then remove it.
  trustedOrigins: [
    process.env.DASHBOARD_URL,
    ...(process.env.EXTRA_TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ].filter((v): v is string => Boolean(v)),
  advanced: {
    // Session cookie must be sendable cross-origin (dashboard -> this API).
    // Safe: Better Auth's originCheckMiddleware validates every mutating
    // request's Origin header against trustedOrigins regardless of this
    // setting, so this doesn't weaken CSRF protection.
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: usersTable,
      session: sessionsTable,
      account: accountsTable,
      verification: verificationsTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    fields: {
      image: "profileImageUrl",
    },
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      // Server-controlled: never accepted from the signup body.
      role: { type: "string", required: false, input: false, defaultValue: "viewer" },
      status: { type: "string", required: false, input: false, defaultValue: "active" },
      forcePasswordReset: { type: "boolean", required: false, input: false, defaultValue: false },
      lastLogin: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: SESSION_TTL_SECONDS,
  },
  databaseHooks: {
    user: {
      create: {
        // Preserves the previous OIDC-era behavior: the first account ever
        // created becomes CEO, everyone after that starts as viewer.
        before: async (user) => {
          const first = await isFirstUser();
          return {
            data: {
              ...user,
              role: first ? "ceo" : "viewer",
              status: "active",
            },
          };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await db
            .update(usersTable)
            .set({ lastLogin: new Date() })
            .where(eq(usersTable.id, session.userId))
            .catch(() => {});
        },
      },
    },
  },
  // Lets the mobile app authenticate with `Authorization: Bearer <token>`
  // instead of a cookie.
  plugins: [bearer()],
});
