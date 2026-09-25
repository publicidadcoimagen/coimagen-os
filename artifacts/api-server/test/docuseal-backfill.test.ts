import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { contractsTable } from "@workspace/db";
import { backfillSignedDocumentUrls, needsSignedDocumentBackfill, type BackfillDeps } from "../src/lib/docuseal/backfill";

type ContractRow = typeof contractsTable.$inferSelect;

function row(overrides: Partial<ContractRow>): ContractRow {
  return {
    id: 4, type: "starter", status: "signed", title: "PRUEBA — contrato", isTest: true,
    description: null, service: null, clientId: 25, proposalId: null, projectId: null,
    workflowId: null, invoiceId: null, approvalId: null, content: null, amount: null,
    currency: "MXN", terms: null, notes: null, sentAt: null, signedAt: new Date(),
    expiresAt: null, createdBy: null, signedBy: "x@example.com", createdAt: new Date(),
    updatedAt: null, docusealSubmissionId: "7", docusealExternalId: "4", signingUrl: null,
    signedDocumentUrl: null, auditLogUrl: null, signerIp: null,
    ...overrides,
  };
}

function fakeDeps(result: string | null | Error) {
  const calls = { fetched: [] as string[], persisted: [] as Array<[number, string]> };
  const deps: BackfillDeps = {
    fetchUrl: async (id) => {
      calls.fetched.push(id);
      if (result instanceof Error) throw result;
      return result;
    },
    persist: async (contractId, url) => { calls.persisted.push([contractId, url]); },
  };
  return { deps, calls };
}

describe("needsSignedDocumentBackfill", () => {
  test("signed row with a submission and no PDF needs it", () => {
    assert.equal(needsSignedDocumentBackfill(row({})), true);
  });
  test("active row also qualifies", () => {
    assert.equal(needsSignedDocumentBackfill(row({ status: "active" })), true);
  });
  test("unsigned row never triggers a DocuSeal call", () => {
    assert.equal(needsSignedDocumentBackfill(row({ status: "sent" })), false);
  });
  test("row that already has the PDF is left alone", () => {
    assert.equal(needsSignedDocumentBackfill(row({ signedDocumentUrl: "https://x/y.pdf" })), false);
  });
  test("manually-signed row with no DocuSeal submission is left alone", () => {
    assert.equal(needsSignedDocumentBackfill(row({ docusealSubmissionId: null })), false);
  });
});

describe("backfillSignedDocumentUrls", () => {
  test("fetches, persists and returns the URL once DocuSeal has built it", async () => {
    const { deps, calls } = fakeDeps("https://firmas.example/file/a/b.pdf");
    const [out] = await backfillSignedDocumentUrls([row({})], deps);
    assert.equal(out.signedDocumentUrl, "https://firmas.example/file/a/b.pdf");
    assert.deepEqual(calls.fetched, ["7"]);
    assert.deepEqual(calls.persisted, [[4, "https://firmas.example/file/a/b.pdf"]]);
  });

  test("PDF still not built: returns row unchanged, persists nothing", async () => {
    const { deps, calls } = fakeDeps(null);
    const [out] = await backfillSignedDocumentUrls([row({})], deps);
    assert.equal(out.signedDocumentUrl, null);
    assert.equal(calls.persisted.length, 0);
  });

  test("DocuSeal error never breaks the read", async () => {
    const { deps, calls } = fakeDeps(new Error("DocuSeal down"));
    const [out] = await backfillSignedDocumentUrls([row({})], deps);
    assert.equal(out.signedDocumentUrl, null);
    assert.equal(calls.persisted.length, 0);
  });

  test("only rows that need it hit DocuSeal", async () => {
    const { deps, calls } = fakeDeps("https://firmas.example/file/c/d.pdf");
    const rows = [row({ id: 1, status: "sent" }), row({ id: 2, signedDocumentUrl: "https://x/y.pdf" }), row({ id: 3, docusealSubmissionId: "9" })];
    const out = await backfillSignedDocumentUrls(rows, deps);
    assert.deepEqual(calls.fetched, ["9"]);
    assert.equal(out[0].signedDocumentUrl, null);
    assert.equal(out[1].signedDocumentUrl, "https://x/y.pdf");
    assert.equal(out[2].signedDocumentUrl, "https://firmas.example/file/c/d.pdf");
  });
});
