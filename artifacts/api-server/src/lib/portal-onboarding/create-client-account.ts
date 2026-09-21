import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { auth } from "../auth";

// 12 url-safe chars (A-Za-z0-9-_) — comfortably clears Better Auth's default
// minPasswordLength (8), never seen again after the client's first login
// forces a change (forcePasswordReset below), so readability doesn't matter.
function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}

// Creates the role="cliente" portal account the FIRST time a given client
// pays anything, with a real temporary password (not a "set your own"
// reset link) — Camila's explicit call, see the conversation this shipped
// from. Returns null if an account already exists for this clientId (the
// caller uses that to skip the credentials email on a later payment).
//
// Deliberately does NOT reuse routes/admin.ts's raw `db.insert(usersTable)`
// pattern by itself: that path never creates a matching credential row, so
// those 3 real staff accounts have no password until a separate reset flow
// runs. A real temporary password needs an actual "credential" account row,
// which only Better Auth's own hasher/internalAdapter can create correctly.
// auth.emailAndPassword.disableSignUp gates signUpEmail from the inside
// (checked in its handler, not just at the route), so calling that endpoint
// programmatically would still throw — this bypasses the disabled endpoint
// entirely rather than working around the gate, by inserting the user row
// directly (same as admin.ts) and using Better Auth's official
// internalAdapter.linkAccount + password.hash for the credential row only.
export async function createClientPortalAccount(
  clientId: number,
  name: string,
  email: string,
): Promise<{ temporaryPassword: string } | null> {
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.clientId, clientId), eq(usersTable.role, "cliente")));
  if (existing) return null;

  const temporaryPassword = generateTemporaryPassword();

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    role: "cliente",
    clientId,
    status: "active",
    emailVerified: false,
    // Enforced by authMiddleware.ts on every request — cleared automatically
    // once the client changes it (account.ts / auth.ts's onPasswordReset),
    // same mechanism already built and used for admin-seeded staff accounts.
    forcePasswordReset: true,
  }).returning();

  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(temporaryPassword);
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: passwordHash,
  });

  return { temporaryPassword };
}
