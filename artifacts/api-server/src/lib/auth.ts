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
import { sendPasswordResetEmail } from "./reset-password-email";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  // No fallback on purpose (P-38 security audit): a hardcoded fallback here
  // previously bypassed Better Auth's own "you're using a default secret in
  // production" safety check, since that check only compares against
  // Better Auth's own internal default string — a *different* hardcoded
  // fallback of ours was invisible to it. Every session, including CEO's,
  // would have been signed with a secret sitting in plaintext in this repo.
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

export async function isFirstUser(): Promise<boolean> {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  return existing.length === 0;
}

export const auth = betterAuth({
  secret: sessionSecret,
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
    // Dashboard (portal.coimagenmedia.com) and this API
    // (api.coimagenmedia.com) are different hosts but the same registrable
    // domain, so browsers treat requests between them as same-site, not
    // cross-site — SameSite=Lax cookies are sent on same-site fetches
    // regardless of method. This only holds because both share
    // coimagenmedia.com; if the dashboard is ever served from a different
    // domain (e.g. a vercel.app preview) again, its requests need "none".
    defaultCookieAttributes: {
      sameSite: "lax",
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
    // P-38: public self-registration was never how any real account got
    // created here (all 3 real users were provisioned manually/by Code) —
    // closing it off. Sign-in, password reset, and account provisioning by
    // an admin (routes/admin.ts) are untouched; only the open POST
    // /api/auth/sign-up/email endpoint is disabled. The automatic
    // invitation flow (triggered from client onboarding, approval tied to
    // that invitation) is a separate future design, not built here.
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
    resetPasswordTokenExpiresIn: 3600,
    // A reset is a stronger proof of ownership than whatever left the old
    // sessions logged in — don't leave a stale/possibly-compromised session
    // alive elsewhere after the password changes.
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      // Mirrors the explicit clear in routes/account.ts's own
      // change-password endpoint: a self-service reset is just as valid a
      // proof of ownership as the in-app "forced" change flow, so it should
      // clear the flag the same way — otherwise a user who resets via email
      // still lands back on ForcePasswordResetScreen right after logging in
      // with their new password.
      await db.update(usersTable).set({ forcePasswordReset: false }).where(eq(usersTable.id, user.id));
    },
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
