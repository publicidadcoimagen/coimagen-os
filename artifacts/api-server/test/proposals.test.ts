import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, IRouter } from "express";
import proposalsRouter from "../src/routes/proposals";

// Only exercises the "accepted" guard, which runs right after body parsing
// and before any DB access — same limitation/rationale as
// public-proposals.test.ts. Regression coverage for proposal #7
// ("ECOMERCE", 2026-09-15): created directly with status "accepted" from
// the staff dialog, which silently skipped payment-schedule invoice
// generation (that only happens via POST /public/proposals/:token/approve).

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

function createMockRequest(body: Record<string, unknown>, params: Record<string, string> = {}): Request {
  return { body, params } as unknown as Request;
}

type RouteStackLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
};

// The real handler sits after requireRole in the stack, so this grabs the
// last registered layer for the path/method rather than the first (unlike
// public-proposals.test.ts, whose routes have no middleware in front).
function findRouteHandler(
  router: IRouter,
  method: "post" | "patch",
  path: string,
): (req: Request, res: Response) => Promise<void> {
  const stack = (router as unknown as { stack: RouteStackLayer[] }).stack;
  for (const layer of stack) {
    if (layer.route?.path === path && layer.route.methods[method]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`No ${method.toUpperCase()} route registered for ${path}`);
}

describe("POST /proposals", () => {
  test("rejects status: accepted before touching the database", async () => {
    const handler = findRouteHandler(proposalsRouter, "post", "/proposals");
    const req = createMockRequest({ title: "Test", status: "accepted" });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match((res.body as { error: string }).error, /enlace público/);
  });
});

describe("PATCH /proposals/:id", () => {
  test("rejects status: accepted before touching the database", async () => {
    const handler = findRouteHandler(proposalsRouter, "patch", "/proposals/:id");
    const req = createMockRequest({ status: "accepted" }, { id: "1" });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match((res.body as { error: string }).error, /enlace público/);
  });
});
