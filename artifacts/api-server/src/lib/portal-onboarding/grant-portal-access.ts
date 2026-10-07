import { eq, and } from "drizzle-orm";
import { db, clientsTable, usersTable, auditLogsTable } from "@workspace/db";
import { ensureClientRoom } from "../client-room/ensure-organization";
import { createClientPortalAccount } from "./create-client-account";
import { sendPortalCredentialsEmail } from "./credentials-email";
import { logger } from "../logger";

export type GrantPortalAccessResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; status: 404; error: "client_not_found" }
  | { ok: false; status: 400; error: "client_has_no_email" }
  | { ok: false; status: 409; error: "already_has_portal_access" }
  | { ok: false; status: 409; error: "email_in_use" };

type Executor = Pick<typeof db, "select" | "insert">;

// Everything with a side effect outside the DB rows checked here is
// injectable, so tests run the real checks + audit against PGlite without
// creating Better Auth credentials or sending real email.
export type GrantPortalAccessDeps = {
  db: Executor;
  ensureRoom: (clientId: number) => Promise<unknown>;
  createAccount: typeof createClientPortalAccount;
  sendCredentials: typeof sendPortalCredentialsEmail;
};

const defaultDeps: GrantPortalAccessDeps = {
  db,
  ensureRoom: (clientId) => ensureClientRoom(clientId),
  createAccount: createClientPortalAccount,
  sendCredentials: sendPortalCredentialsEmail,
};

// Staff-triggered version of what on-installment-paid.ts does on a client's
// first payment: Client Room + role="cliente" login with a temporary
// password + credentials email. Until now that payment was the ONLY way a
// client got a portal login — a client created by hand, pro bono, or billed
// with a manual invoice never got one.
//
// The temporary password is never returned to the caller: if the email
// fails, the account still exists and the client can recover access with
// "olvidé mi contraseña" (same Resend-backed reset flow staff use). It does
// not expire on its own — forcePasswordReset makes the client replace it on
// first login.
//
// Every attempt — granted or refused — writes an audit_logs row with who
// asked, for which client, and the outcome.
export async function grantPortalAccess(
  clientId: number,
  actor: { id: string; label: string },
  deps: GrantPortalAccessDeps = defaultDeps,
): Promise<GrantPortalAccessResult> {
  const result = await attempt(clientId, deps);
  await deps.db.insert(auditLogsTable).values({
    userId: actor.id,
    module: "Clientes",
    action: "Otorgar acceso al portal",
    result: result.ok
      ? `Acceso al portal otorgado al cliente #${clientId}${result.emailSent ? " — credenciales enviadas" : " — correo falló"}`
      : `Acceso al portal rechazado para el cliente #${clientId}: ${result.error}`,
    status: result.ok ? "success" : "failure",
    metadata: JSON.stringify({ clientId, actor: actor.label, ...(result.ok ? { emailSent: result.emailSent } : { error: result.error }) }),
  });
  return result;
}

async function attempt(clientId: number, deps: GrantPortalAccessDeps): Promise<GrantPortalAccessResult> {
  const [client] = await deps.db.select({ id: clientsTable.id, name: clientsTable.name, email: clientsTable.email })
    .from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return { ok: false, status: 404, error: "client_not_found" };
  if (!client.email) return { ok: false, status: 400, error: "client_has_no_email" };

  const [existingLogin] = await deps.db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.clientId, clientId), eq(usersTable.role, "cliente")));
  if (existingLogin) return { ok: false, status: 409, error: "already_has_portal_access" };

  // users.email is unique — a staff account or another client's login with
  // this address would make the insert below fail with a raw 500.
  const [emailTaken] = await deps.db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, client.email));
  if (emailTaken) return { ok: false, status: 409, error: "email_in_use" };

  await deps.ensureRoom(clientId);
  const created = await deps.createAccount(clientId, client.name, client.email);
  // A concurrent request may have created it between the check and here.
  if (!created) return { ok: false, status: 409, error: "already_has_portal_access" };

  try {
    const emailId = await deps.sendCredentials(client.email, client.name, created.temporaryPassword);
    logger.info({ clientId, emailId }, "Acceso al portal otorgado por staff y credenciales enviadas");
    return { ok: true, emailSent: true };
  } catch (err) {
    logger.warn({ err, clientId }, "Cuenta de portal creada por staff, pero no se pudo enviar el correo de credenciales");
    return { ok: true, emailSent: false };
  }
}
