import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { actorLabel, approvalUpdate, reviewerOnCreate } from "../src/lib/approvals/reviewer";

describe("approvals reviewer — always the session user, never the body", () => {
  test("PATCH with a status change: body reviewedBy is replaced by the actor", () => {
    assert.deepEqual(
      approvalUpdate({ status: "approved", reviewedBy: "Camila Segovia" }, "admin@coimagen"),
      { status: "approved", reviewedBy: "admin@coimagen" },
    );
  });

  test("PATCH without a status change: body reviewedBy is dropped, not written", () => {
    const update = approvalUpdate({ notes: "x", reviewedBy: "Alguien más" }, "admin@coimagen");
    assert.deepEqual(update, { notes: "x" });
    assert.equal("reviewedBy" in update, false);
  });

  test("POST: decided approvals record the creator, drafts have no reviewer", () => {
    assert.equal(reviewerOnCreate("approved", "Ana"), "Ana");
    assert.equal(reviewerOnCreate("rejected", "Ana"), "Ana");
    assert.equal(reviewerOnCreate("draft", "Ana"), null);
    assert.equal(reviewerOnCreate(undefined, "Ana"), null);
  });

  test("actor label: name, then email, then id", () => {
    assert.equal(actorLabel({ id: "u1", name: "Ana", email: "a@x" }), "Ana");
    assert.equal(actorLabel({ id: "u1", name: null, email: "a@x" }), "a@x");
    assert.equal(actorLabel({ id: "u1" }), "u1");
  });
});
