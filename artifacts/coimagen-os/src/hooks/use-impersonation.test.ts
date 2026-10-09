import { test, describe } from "node:test";
import assert from "node:assert/strict";

// use-impersonation.ts calls sessionStorage.setItem/removeItem (via
// setState/endLocally) whenever applyImpersonationStart/End run — Node has
// no sessionStorage global, unlike a browser. A minimal in-memory stub is
// enough: these tests only exercise the module's own state-machine logic,
// never a real browser Storage implementation.
const storageBackingStore = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (key: string) => storageBackingStore.get(key) ?? null,
  setItem: (key: string, value: string) => { storageBackingStore.set(key, value); },
  removeItem: (key: string) => { storageBackingStore.delete(key); },
};

const { applyImpersonationStart, applyImpersonationEnd, getSnapshot } = await import("./impersonation-store");
const { customFetch } = await import("@workspace/api-client-react");

// Mirrors the real shape closely enough for these tests: a staff AuthUser
// (role ceo/admin, enabledModules always []) vs. the cliente-role view a
// correct /api/auth/user response returns once impersonating (see
// impersonation.test.ts in api-server, which proves the backend side of
// this against real production data).
type FakeAuthUser = { role: string; clientId: number | null; enabledModules: string[] };

describe("applyImpersonationStart — the fix for Catálogo staying hidden while impersonating", () => {
  test("bug reproduction: after start, the auth hook's user reflects the client's role/enabledModules, not the stale staff value", async () => {
    let user: FakeAuthUser = { role: "ceo", clientId: null, enabledModules: [] };
    const calls: string[] = [];

    const refreshUser = async () => {
      calls.push("refreshUser");
      // Simulates what AuthProvider.refetchUser really does: re-fetch
      // /api/auth/user, which — now that impersonation's own token has
      // been attached by setState() before this runs — the backend
      // resolves to the impersonated client's real role/enabledModules.
      user = { role: "cliente", clientId: 5, enabledModules: ["ecommerce"] };
    };
    const navigate = (path: string) => { calls.push(`navigate:${path}`); };

    await applyImpersonationStart(
      { token: "tok-start", expiresAt: new Date(Date.now() + 60_000).toISOString(), clientId: 5, clientSlug: "becky-beck", clientName: "Betty" },
      refreshUser,
      navigate,
    );

    assert.equal(user.role, "cliente");
    assert.equal(user.clientId, 5);
    assert.deepEqual(user.enabledModules, ["ecommerce"], "the exact symptom: Catálogo's nav entry only renders when enabledModules includes ecommerce");
  });

  test("refreshes the session BEFORE navigating — the client room must never render on the stale staff user for even one frame", async () => {
    const calls: string[] = [];
    const refreshUser = async () => { calls.push("refreshUser"); };
    const navigate = (path: string) => { calls.push(`navigate:${path}`); };

    await applyImpersonationStart(
      { token: "tok-order", expiresAt: new Date(Date.now() + 60_000).toISOString(), clientId: 5, clientSlug: "becky-beck", clientName: "Betty" },
      refreshUser,
      navigate,
    );

    assert.deepEqual(calls, ["refreshUser", "navigate:/client/becky-beck"]);
  });
});

describe("applyImpersonationEnd — the reverse path back to the staff's own session", () => {
  test("after ending, the auth hook's user reflects the staff's own role again, not the client's", async () => {
    let user: FakeAuthUser = { role: "cliente", clientId: 5, enabledModules: ["ecommerce"] };
    const refreshUser = async () => {
      user = { role: "ceo", clientId: null, enabledModules: [] };
    };
    const navigate = () => {};

    await applyImpersonationEnd(
      { token: "tok-end", expiresAt: new Date(Date.now() + 60_000).toISOString(), clientId: 5, clientSlug: "becky-beck", clientName: "Betty" },
      refreshUser,
      navigate,
    );

    assert.equal(user.role, "ceo");
    assert.deepEqual(user.enabledModules, []);
  });

  test("refreshes the session BEFORE navigating back to the staff dashboard", async () => {
    const calls: string[] = [];
    const refreshUser = async () => { calls.push("refreshUser"); };
    const navigate = (path: string) => { calls.push(`navigate:${path}`); };

    await applyImpersonationEnd(
      { token: "tok-end-order", expiresAt: new Date(Date.now() + 60_000).toISOString(), clientId: 5, clientSlug: "becky-beck", clientName: "Betty" },
      refreshUser,
      navigate,
    );

    assert.deepEqual(calls, ["refreshUser", "navigate:/clients/5"]);
  });
});

// 2026-10-08: Camila's PC had its UTC clock 1 h ahead (Windows "Pacífico" with
// DST adjustment off, wall clock hand-corrected). The server's absolute
// expiresAt (now + 30 min, server clock) was already in the past on that
// browser, so the session was cleared silently before refreshUser — no
// banner, no x-impersonate-token, no Catálogo, while the page still navigated.
describe("applyImpersonationStart — browser clock 1 h ahead of the server", () => {
  const HOUR = 60 * 60 * 1000;

  async function withSkewedClock<T>(fn: () => Promise<T>): Promise<T> {
    const realNow = Date.now;
    const skewed = realNow() + HOUR;
    Date.now = () => skewed;
    try { return await fn(); } finally { Date.now = realNow; }
  }

  async function headerSentBy(): Promise<string | null> {
    const realFetch = globalThis.fetch;
    let sent: string | null = null;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      sent = new Headers(init?.headers).get("x-impersonate-token");
      return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try { await customFetch("/api/auth/user"); } finally { globalThis.fetch = realFetch; }
    return sent;
  }

  test("state, sessionStorage and the x-impersonate-token header all survive (expiresInSeconds from the server)", async () => {
    const serverNow = Date.now();
    const calls: string[] = [];
    let expiredNotice = 0;
    await withSkewedClock(() => applyImpersonationStart(
      { token: "tok-skew", expiresAt: new Date(serverNow + 30 * 60_000).toISOString(), expiresInSeconds: 1800, clientId: 26, clientSlug: "building-levis", clientName: "building levis" },
      async () => { calls.push("refreshUser"); },
      (path) => { calls.push(`navigate:${path}`); },
      () => { expiredNotice++; },
    ));

    assert.equal(expiredNotice, 0);
    assert.deepEqual(calls, ["refreshUser", "navigate:/client/building-levis"]);
    const state = getSnapshot();
    assert.equal(state?.token, "tok-skew", "store state kept — the banner renders from this");
    assert.ok(storageBackingStore.get("coimagen:impersonation")?.includes("tok-skew"), "sessionStorage kept");
    assert.ok(new Date(state!.expiresAt).getTime() > Date.now() + HOUR, "deadline is on the browser's own (skewed) clock");
    assert.equal(await headerSentBy(), "tok-skew", "the next API call carries x-impersonate-token");
  });

  test("a session that arrives already expired shows a visible notice and doesn't navigate (old API without expiresInSeconds)", async () => {
    await applyImpersonationEnd(getSnapshot()!, async () => {}, () => {});
    const serverNow = Date.now();
    const calls: string[] = [];
    let expiredNotice = 0;
    await withSkewedClock(() => applyImpersonationStart(
      { token: "tok-old-api", expiresAt: new Date(serverNow + 30 * 60_000).toISOString(), clientId: 26, clientSlug: "building-levis", clientName: "building levis" },
      async () => { calls.push("refreshUser"); },
      (path) => { calls.push(`navigate:${path}`); },
      () => { expiredNotice++; },
    ));

    assert.equal(expiredNotice, 1, "visible notice instead of a silent clear");
    assert.deepEqual(calls, [], "no refresh, no navigation into a room with no session");
    assert.equal(getSnapshot(), null);
    assert.equal(await headerSentBy(), null);
  });
});
