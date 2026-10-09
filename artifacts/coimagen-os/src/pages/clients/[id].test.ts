// Run: npx tsx --experimental-test-module-mocks "src/pages/clients/[id].test.ts"
import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";

// The page imports @workspace/better-auth-web, whose `react` peer only
// resolves inside Vite's bundler context, not under plain Node/tsx (same
// constraint use-impersonation.test.ts works around). Only useAuth is
// referenced, and only inside the component, never by the helper tested here.
mock.module("@workspace/better-auth-web", { namedExports: { useAuth: () => ({ user: null }) } });

const { portalAccessButton } = await import("./[id]");

describe("portalAccessButton — which portal-access button the client page shows", () => {
  test("nothing while the overview hasn't loaded (it used to fall back to 'Enviar acceso' → 409)", () => {
    assert.equal(portalAccessButton(undefined, 26), null);
  });
  test("nothing while this client's row isn't in the overview yet", () => {
    assert.equal(portalAccessButton([{ clientId: 7, hasPortalAccount: true }], 26), null);
  });
  test("'Reenviar acceso' when the client already has a portal login", () => {
    assert.equal(portalAccessButton([{ clientId: 26, hasPortalAccount: true }], 26), "resend");
  });
  test("'Enviar acceso al portal' only when the loaded row says there's no login", () => {
    assert.equal(portalAccessButton([{ clientId: 26, hasPortalAccount: false }], 26), "grant");
  });
});
