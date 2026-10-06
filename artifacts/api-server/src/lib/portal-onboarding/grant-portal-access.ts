import { eq, and } from "drizzle-orm";
import { db, clientsTable, usersTable } from "@workspace/db";
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

// Staff-triggered version of what on-installment-paid.ts does on a client's
// first payment: Client Room + role="cliente" login with a temporary
// password + credentials email. Until now that payment was the ONLY way a
// client got a portal login — a client created by hand, pro bono, or billed
// with a manual invoice never got one.
//
// The temporary password is never returned to the caller: if the email
// fails, the account still exists and the client can recover access with
// "olvidé mi contraseña" (same Resend-backed reset flow staff use).
export async function grantPortalAccess(clientId: number): Promise<GrantPortalAccessResult> {
  const [client] = await db.select({ id: clientsTable.id, name: clientsTable.name, email: clientsTable.email })
    .from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return { ok: false, status: 404, error: "client_not_found" };
  if (!client.email) return { ok: false, status: 400, error: "client_has_no_email" };

  const [existingLogin] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.clientId, clientId), eq(usersTable.role, "cliente")));
  if (existingLogin) return { ok: false, status: 409, error: "already_has_portal_access" };

  // users.email is unique — a staff account or another client's login with
  // this address would make the insert below fail with a raw 500.
  const [emailTaken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, client.email));
  if (emailTaken) return { ok: false, status: 409, error: "email_in_use" };

  await ensureClientRoom(clientId);
  const created = await createClientPortalAccount(clientId, client.name, client.email);
  // A concurrent request may have created it between the check and here.
  if (!created) return { ok: false, status: 409, error: "already_has_portal_access" };

  try {
    const emailId = await sendPortalCredentialsEmail(client.email, client.name, created.temporaryPassword);
    logger.info({ clientId, emailId }, "Acceso al portal otorgado por staff y credenciales enviadas");
    return { ok: true, emailSent: true };
  } catch (err) {
    logger.warn({ err, clientId }, "Cuenta de portal creada por staff, pero no se pudo enviar el correo de credenciales");
    return { ok: true, emailSent: false };
  }
}
