import { eq } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";
import { logger } from "../logger";
import { getDocusealCombinedDocumentUrl } from "./client";

type ContractRow = typeof contractsTable.$inferSelect;

// DocuSeal builds the combined (signed) PDF asynchronously: the webhook's
// own follow-up fetch runs ~2s after completion and gets null back — seen
// for real on contract 4 / submission 7 (2026-09-23), where the same GET
// returned the URL minutes later. The URL itself is stable (no expiring
// query token), so it's safe to persist once found. Rather than a retry
// loop inside the webhook, fill it lazily on read: any signed/active row
// still missing it gets one best-effort fetch, persisted, so it only ever
// costs one DocuSeal call per contract.
export function needsSignedDocumentBackfill(row: ContractRow): boolean {
  return (row.status === "signed" || row.status === "active")
    && !row.signedDocumentUrl
    && !!row.docusealSubmissionId;
}

export interface BackfillDeps {
  fetchUrl: (submissionId: string) => Promise<string | null>;
  persist: (contractId: number, url: string) => Promise<void>;
}

const defaultDeps: BackfillDeps = {
  fetchUrl: getDocusealCombinedDocumentUrl,
  persist: async (contractId, url) => {
    await db.update(contractsTable).set({ signedDocumentUrl: url }).where(eq(contractsTable.id, contractId));
  },
};

// Never throws and never blocks the read: a DocuSeal outage just means the
// row is returned as-is (still null), and the next read tries again.
export async function backfillSignedDocumentUrls(rows: ContractRow[], deps: BackfillDeps = defaultDeps): Promise<ContractRow[]> {
  return Promise.all(rows.map(async (row) => {
    if (!needsSignedDocumentBackfill(row)) return row;
    try {
      const url = await deps.fetchUrl(row.docusealSubmissionId!);
      if (!url) return row;
      await deps.persist(row.id, url);
      return { ...row, signedDocumentUrl: url };
    } catch (err) {
      logger.warn({ err, contractId: row.id }, "Backfill de signedDocumentUrl falló — se reintenta en la próxima lectura");
      return row;
    }
  }));
}
