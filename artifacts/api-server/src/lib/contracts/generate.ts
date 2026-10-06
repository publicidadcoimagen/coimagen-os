import { and, eq } from "drizzle-orm";
import { db, contractsTable, proposalsTable, auditLogsTable, type Contract } from "@workspace/db";
import { contractFromProposalError, contractValuesFromProposal, type ContractFromProposalError } from "./from-proposal";

export type GenerateContractResult =
  | { ok: true; contract: Contract }
  | { ok: false; status: 404; error: "proposal_not_found" }
  | { ok: false; status: 409; error: ContractFromProposalError }
  | { ok: false; status: 409; error: "contract_already_exists"; contractId: number };

// One live (non-test) contract per proposal, atomically. Everything runs in
// one transaction that first takes a row lock on the proposal
// (SELECT ... FOR UPDATE): a second request for the same proposal blocks
// until the first commits, then sees its contract and returns 409 — two
// near-simultaneous clicks can never insert two contracts. No schema change
// needed (a partial unique index would require a coordinated DB push).
//
// The audit row is written in the same transaction, so a contract can never
// exist without its "who generated it" record. `dbClient` is overridable so
// tests run this exact code against a real embedded Postgres (PGlite).
export async function generateContractFromProposal(
  proposalId: number,
  type: string,
  actor: { id: string; label: string },
  dbClient: Pick<typeof db, "transaction"> = db,
): Promise<GenerateContractResult> {
  return dbClient.transaction(async (tx) => {
    const [proposal] = await tx.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId)).for("update");
    if (!proposal) return { ok: false, status: 404, error: "proposal_not_found" };

    const invalid = contractFromProposalError(proposal);
    if (invalid) return { ok: false, status: 409, error: invalid };

    const [existing] = await tx.select({ id: contractsTable.id }).from(contractsTable)
      .where(and(eq(contractsTable.proposalId, proposalId), eq(contractsTable.isTest, false)));
    if (existing) return { ok: false, status: 409, error: "contract_already_exists", contractId: existing.id };

    const [contract] = await tx.insert(contractsTable).values(contractValuesFromProposal(proposal, type, actor.label)).returning();

    await tx.insert(auditLogsTable).values({
      userId: actor.id,
      module: "Contratos",
      action: "Generar contrato desde propuesta",
      result: `Contrato #${contract.id} generado desde propuesta #${proposalId} para cliente #${proposal.clientId}`,
      status: "success",
      metadata: JSON.stringify({ contractId: contract.id, proposalId, clientId: proposal.clientId, type, actor: actor.label }),
    });

    return { ok: true, contract };
  });
}
