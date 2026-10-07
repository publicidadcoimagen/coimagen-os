import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPortalCredentialsEmailHtml } from "../src/lib/portal-onboarding/credentials-email";
import { PORTAL_LOGIN_URL } from "../src/lib/portal-url";

describe("portal credentials email — login link", () => {
  const html = buildPortalCredentialsEmailHtml("cliente@example.com", "Tienda <Ropa>", "Temp-Pass-123");

  test("the button points at the real portal, portal.coimagenmedia.com", () => {
    assert.equal(PORTAL_LOGIN_URL, "https://portal.coimagenmedia.com/");
    assert.ok(html.includes(`href="https://portal.coimagenmedia.com/"`));
  });
  test("never links to os.coimagenmedia.com (NXDOMAIN — the client could never log in)", () => {
    assert.ok(!html.includes("os.coimagenmedia.com"));
  });
  test("still carries the email, the temporary password and an escaped client name", () => {
    assert.ok(html.includes("cliente@example.com"));
    assert.ok(html.includes("Temp-Pass-123"));
    assert.ok(html.includes("Tienda &lt;Ropa&gt;"));
  });
});
