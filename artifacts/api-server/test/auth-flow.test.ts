import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, IRouter } from "express";
import { APIError } from "better-auth/api";
import { auth } from "../src/lib/auth";
import { authMiddleware } from "../src/middlewares/authMiddleware";
import { requireAuth, requireRole } from "../src/middlewares/requireAuth";
import authRouter, { getCurrentAuthUser } from "../src/routes/auth";

// Better Auth's own sign-up/sign-in/hashing/session-storage logic is the
// library's responsibility, not ours — these tests stub its `auth.api.*`
// methods (via node:test's per-test method mocking, auto-restored after
// each test) and exercise our own integration code: authMiddleware's
// mapping from a Better Auth session to req.user, requireAuth/requireRole's
// gating, and the auth routes.

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    log: { error: () => {} },
    ...overrides,
  } as unknown as Request;
}

type RouteStackLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
};

// Express routers don't expose a friendly "get handler by path" API, so we
// walk the router's internal stack. This is the same router the app mounts
// in production — no separate test-only wiring.
function findRouteHandler(
  router: IRouter,
  method: "get" | "post",
  path: string,
): (req: Request, res: Response) => Promise<void> {
  const stack = (router as unknown as { stack: RouteStackLayer[] }).stack;
  for (const layer of stack) {
    if (layer.route?.path === path && layer.route.methods[method]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`No ${method.toUpperCase()} route registered for ${path}`);
}

describe("authMiddleware", () => {
  test("leaves req.user unset and isAuthenticated() false when there is no session", async (t) => {
    t.mock.method(auth.api, "getSession", async () => null);

    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(req.user, undefined);
    assert.equal(req.isAuthenticated(), false);
    assert.equal(nextCalled, true);
  });

  test("maps a Better Auth session onto req.user, including the image -> profileImageUrl rename", async (t) => {
    t.mock.method(auth.api, "getSession", async () => ({
      session: { id: "s1" },
      user: {
        id: "u1",
        email: "ceo@coimagen.com",
        firstName: "Camila",
        lastName: "Segovia",
        image: "https://example.com/avatar.png",
        role: "ceo",
      },
    }));

    const req = createMockRequest();
    const res = createMockResponse();
    await authMiddleware(req, res, () => {});

    assert.equal(req.isAuthenticated(), true);
    assert.deepEqual(req.user, {
      id: "u1",
      email: "ceo@coimagen.com",
      firstName: "Camila",
      lastName: "Segovia",
      profileImageUrl: "https://example.com/avatar.png",
      role: "ceo",
    });
  });

  test("defaults role to viewer and nullable fields to null when Better Auth omits them", async (t) => {
    t.mock.method(auth.api, "getSession", async () => ({
      session: { id: "s2" },
      user: { id: "u2", email: "new@coimagen.com" },
    }));

    const req = createMockRequest();
    const res = createMockResponse();
    await authMiddleware(req, res, () => {});

    assert.deepEqual(req.user, {
      id: "u2",
      email: "new@coimagen.com",
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      role: "viewer",
    });
  });
});

describe("requireAuth / requireRole", () => {
  test("requireAuth returns 401 when not authenticated", () => {
    const req = createMockRequest({ isAuthenticated: () => false } as Partial<Request>);
    const res = createMockResponse();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  test("requireAuth calls next() when authenticated", () => {
    const req = createMockRequest({ isAuthenticated: () => true } as Partial<Request>);
    const res = createMockResponse();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test("requireRole returns 403 for a role outside the allowed set", () => {
    const req = createMockRequest({
      isAuthenticated: () => true,
      user: { id: "u1", role: "viewer" } as Request["user"],
    } as Partial<Request>);
    const res = createMockResponse();
    let nextCalled = false;

    requireRole("ceo", "admin")(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  });

  test("requireRole calls next() for an allowed role", () => {
    const req = createMockRequest({
      isAuthenticated: () => true,
      user: { id: "u1", role: "ceo" } as Request["user"],
    } as Partial<Request>);
    const res = createMockResponse();
    let nextCalled = false;

    requireRole("ceo", "admin")(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});

describe("GET /auth/user", () => {
  test("returns { user: null } when not authenticated", async () => {
    const req = createMockRequest({ isAuthenticated: () => false } as Partial<Request>);
    const res = createMockResponse();

    await getCurrentAuthUser(req, res);

    assert.deepEqual(res.body, { user: null });
  });

  test("returns the authenticated user", async () => {
    const user = {
      id: "u1",
      email: "ceo@coimagen.com",
      firstName: "Camila",
      lastName: "Segovia",
      profileImageUrl: null,
      role: "ceo",
    };
    const req = createMockRequest({
      isAuthenticated: () => true,
      user: user as Request["user"],
    } as Partial<Request>);
    const res = createMockResponse();

    await getCurrentAuthUser(req, res);

    assert.deepEqual(res.body, { user });
  });
});

describe("POST /mobile-auth/token-exchange", () => {
  test("returns 400 for a missing password", async () => {
    const handler = findRouteHandler(authRouter, "post", "/mobile-auth/token-exchange");
    const req = createMockRequest({ body: { email: "a@b.com" } } as Partial<Request>);
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
  });

  test("exchanges valid credentials for the bearer token issued by Better Auth", async (t) => {
    const signInEmail = t.mock.method(auth.api, "signInEmail", async () => ({
      headers: new Headers({ "set-auth-token": "bearer-token-123" }),
      response: {},
    }));

    const handler = findRouteHandler(authRouter, "post", "/mobile-auth/token-exchange");
    const req = createMockRequest({
      body: { email: "a@b.com", password: "hunter22" },
    } as Partial<Request>);
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(signInEmail.mock.callCount(), 1);
    assert.deepEqual(signInEmail.mock.calls[0].arguments[0], {
      body: { email: "a@b.com", password: "hunter22" },
      returnHeaders: true,
    });
    assert.deepEqual(res.body, { token: "bearer-token-123" });
  });

  test("returns 401 when Better Auth rejects the credentials", async (t) => {
    t.mock.method(auth.api, "signInEmail", async () => {
      throw APIError.fromStatus("UNAUTHORIZED", { message: "Invalid email or password" });
    });

    const handler = findRouteHandler(authRouter, "post", "/mobile-auth/token-exchange");
    const req = createMockRequest({
      body: { email: "a@b.com", password: "wrong" },
    } as Partial<Request>);
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
  });
});

describe("POST /mobile-auth/logout", () => {
  test("signs the session out and reports success", async (t) => {
    const signOut = t.mock.method(auth.api, "signOut", async () => ({ success: true }));

    const handler = findRouteHandler(authRouter, "post", "/mobile-auth/logout");
    const req = createMockRequest({ headers: { authorization: "Bearer abc" } } as Partial<Request>);
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(signOut.mock.callCount(), 1);
    assert.deepEqual(res.body, { success: true });
  });
});
