import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, clientsTable, usersTable, accountsTable, sessionsTable, auditLogsTable } from "@workspace/db";
import { auth } from "../auth";
import { generateTemporaryPassword } from "./create-client-account";
import { sendPortalCredentialsEmail } from "./credentials-email";
import { logger } from "../logger";

export type ResendPortalAccessResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; status: 404; error: "client_not_found" }
  | { ok: false; status: 404; error: "no_portal_account" };

type Executor = Pick<typeof db, "select" | "insert" | "transaction">;

// Same injection pattern as grant-portal-access.ts: tests run the real
// checks, DB writes and audit against PGlite, with a fake email sender.
export type ResendPortalAccessDeps = {
  db: Executor;
  hashPassword: (password: string) => Promise<string>;
  sendCredentials: typeof sendPortalCredentialsEmail;
};

const defaultDeps: ResendPortalAccessDeps = {
  db,
  hashPassword: async (password) => (await auth.$context).password.hash(password),
  sendCredentials: sendPortalCredentialsEmail,
};

// Staff button "Reenviar acceso": "Enviar acceso al portal" answers 409 once
// a client has a login, so there was no way to send a lost or never-received
// credentials email again. This replaces that login's password with a new
// temporary one, forces a change on next login, and ends its open sessions
// (anyone holding the old password is logged out), then emails it.
//
// The temporary password only ever exists in the email — never returned,
// never logged. If the email fails the reset still stands; the client can
// use "olvidé mi contraseña", or staff can resend again.
export async function resendPortalAccess(
  clientId: number,
  actor: { id: string; label: string },
  deps: ResendPortalAccessDeps = defaultDeps,
): Promise<ResendPortalAccessResult> {
  const result = await attempt(clientId, deps);
  await deps.db.insert(auditLogsTable).values({
    userId: actor.id,
    module: "Clientes",
    action: "Reenviar acceso al portal",
    result: result.ok
      ? `Acceso al portal reenviado al cliente #${clientId}${result.emailSent ? " — credenciales enviadas" : " — correo falló"}`
      : `Reenvío de acceso al portal rechazado para el cliente #${clientId}: ${result.error}`,
    status: result.ok ? "success" : "failure",
    metadata: JSON.stringify({ clientId, actor: actor.label, ...(result.ok ? { emailSent: result.emailSent } : { error: result.error }) }),
  });
  return result;
}

async function attempt(clientId: number, deps: ResendPortalAccessDeps): Promise<ResendPortalAccessResult> {
  const [client] = await deps.db.select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return { ok: false, status: 404, error: "client_not_found" };

  const [login] = await deps.db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable)
    .where(and(eq(usersTable.clientId, clientId), eq(usersTable.role, "cliente")));
  if (!login?.email) return { ok: false, status: 404, error: "no_portal_account" };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await deps.hashPassword(temporaryPassword);

  await deps.db.transaction(async (tx) => {
    const updated = await tx.update(accountsTable)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(accountsTable.userId, login.id), eq(accountsTable.providerId, "credential")))
      .returning({ id: accountsTable.id });
    // A login provisioned without a credential row (routes/admin.ts's raw
    // insert) has no password to replace — give it one, same shape Better
    // Auth's linkAccount writes in create-client-account.ts.
    if (updated.length === 0) {
      await tx.insert(accountsTable).values({ id: randomUUID(), userId: login.id, accountId: login.id, providerId: "credential", password: passwordHash });
    }
    await tx.update(usersTable).set({ forcePasswordReset: true }).where(eq(usersTable.id, login.id));
    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, login.id));
  });

  try {
    const emailId = await deps.sendCredentials(login.email, client.name, temporaryPassword);
    logger.info({ clientId, emailId }, "Acceso al portal reenviado por staff y credenciales enviadas");
    return { ok: true, emailSent: true };
  } catch (err) {
    logger.warn({ err, clientId }, "Contraseña temporal renovada, pero no se pudo enviar el correo de credenciales");
    return { ok: true, emailSent: false };
  }
}
