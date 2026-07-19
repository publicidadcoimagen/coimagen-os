import { type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthUser } from "@workspace/api-zod";
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
    role: user.role ?? "viewer",
    status: user.status ?? "active",
    forcePasswordReset: user.forcePasswordReset ?? false,
    lastLogin: user.lastLogin?.toISOString() ?? null,
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
    req.user = toAuthUser(session.user);
  }

  next();
}
