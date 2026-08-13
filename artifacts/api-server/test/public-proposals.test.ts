import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, IRouter } from "express";
import publicProposalsRouter from "../src/routes/public-proposals";

// Only exercises the gate that runs before any DB access (token param
// validation) — the DB-touching paths (404 for an unknown token, 200 for a
// real proposal, 409 for an already-rejected one, idempotent 200 for an
// already-accepted one) need a real database, same limitation as
// webhooks-jotform.test.ts / webhooks-resend.test.ts.

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

function createMockRequest(params: Record<string, string>): Request {
  return { params } as unknown as Request;
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
// in production — no separate test-only wiring. Same helper as
// auth-flow.test.ts.
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

describe("GET /public/proposals/:token", () => {
  test("rejects a non-UUID token before touching the database", async () => {
    const handler = findRouteHandler(publicProposalsRouter, "get", "/public/proposals/:token");
    const req = createMockRequest({ token: "not-a-real-token" });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
  });
});

describe("POST /public/proposals/:token/approve", () => {
  test("rejects a non-UUID token before touching the database", async () => {
    const handler = findRouteHandler(publicProposalsRouter, "post", "/public/proposals/:token/approve");
    const req = createMockRequest({ token: "not-a-real-token" });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
  });
});
