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
