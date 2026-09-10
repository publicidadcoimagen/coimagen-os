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

const { applyImpersonationStart, applyImpersonationEnd } = await import("./impersonation-store");

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
