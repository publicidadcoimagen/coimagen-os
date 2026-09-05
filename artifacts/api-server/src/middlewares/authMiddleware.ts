import { type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import type { AuthUser, AuthUserRole } from "@workspace/api-zod";
import { auth } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

type SessionUser = typeof auth.$Infer.Session.user;

function toAuthUser(user: SessionUser): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    profileImageUrl: user.image ?? null,
    // Better Auth's additionalFields config can only declare `role` as a
    // plain "string" (see lib/auth.ts) — it has no way to express the
    // ceo/admin/viewer/cliente literal union, so this cast is the one place
    // that gap crosses into the AuthUser contract. Safe: this value only
    // ever comes from users.role, which only ever gets written one of those
    // four values (requireRole/isClienteRole/admin routes are the only
    // writers/readers).
    role: (user.role ?? "viewer") as AuthUserRole,
    status: user.status ?? "active",
    forcePasswordReset: user.forcePasswordReset ?? false,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    clientId: user.clientId ?? null,
    enabledModules: [],
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (session?.user) {
    const authUser = toAuthUser(session.user);
    // The Portal module matrix (P-79) lives on clients.enabled_modules —
    // piggyback it on the session payload so the client-room nav doesn't
    // need a second round trip through a staff-only /clients endpoint.
    if (authUser.role === "cliente" && authUser.clientId != null) {
      const [client] = await db.select({ enabledModules: clientsTable.enabledModules }).from(clientsTable).where(eq(clientsTable.id, authUser.clientId));
      authUser.enabledModules = client?.enabledModules ?? [];
    }
    req.user = authUser;
  }

  next();
}
