import { and, eq, isNull } from "drizzle-orm";
import { db, clientsTable, prospectsTable, proposalsTable, diagnosesTable, clientNotesTable, clientTimelineTable, type Client } from "@workspace/db";
import { createInstallmentInvoices } from "../payment-schedule/repository";

// Prospects whose `source` marks them as test/synthetic data, not a real
// lead — see routes/prospects.ts and Corte 1 (prospect 23, source
// 'manual_test'). Converting one into a real, billable client must never be
// a one-click accident; ConvertProspectBody.confirmTestSource is the
// deliberate override.
export function looksLikeTestSource(source: string | null): boolean {
  if (!source) return false;
  return source === "manual_test" || source.startsWith("test_") || source.startsWith("manual_test");
}

export type ConvertProspectResult =
  | { ok: true; client: Client }
  | { ok: false; status: 404; error: "prospect_not_found" }
  | { ok: false; status: 409; error: "already_converted"; client: Client }
  | { ok: false; status: 409; error: "no_accepted_proposal" }
  | { ok: false; status: 409; error: "test_source_requires_confirmation" };

// Everything below runs inside one transaction (see lib/catalog/repository.ts
// for the one other real precedent of db.transaction in this codebase): if
// any step fails, nothing is left half-done — the prospect stays exactly as
// it was, converted_client_id stays null, safe to retry.
//
// The early convertedClientId read-check above is NOT the real guard against
// a concurrent double-conversion — under READ COMMITTED, two transactions
// starting at nearly the same time both read convertedClientId as null and
// both pass it. Nor does the UNIQUE constraint on converted_client_id save
// this by itself: an UPDATE ... WHERE id = prospectId targets the row by its
// primary key, not by the column being guarded, so a second transaction that
// was blocked on the first's row lock proceeds anyway once that lock is
// released (Postgres re-checks the WHERE clause against the fresh row, which
// still matches) and overwrites converted_client_id to point at ITS OWN
// newly created client — a real client, fully linked, now orphaned. The
// actual guard is the final UPDATE below: it filters on
// `converted_client_id IS NULL` too, so the loser's UPDATE affects zero rows,
// which this function turns into a thrown error to force that transaction's
// own client (and every other write it made) to roll back completely.
export async function convertProspectToClient(
  prospectId: number,
  actor: { id: string; label: string },
  options: { confirmTestSource: boolean },
  // Defaults to the real Neon-backed singleton for every production caller
  // (routes/prospects.ts never passes this). Overridable so tests can run
  // the exact same code against a real embedded Postgres (PGlite) instead —
  // this function's guarantees (transaction atomicity, the UNIQUE
  // constraint) are only meaningfully testable against a real Postgres, not
  // a mock, and the codebase has no separate test database.
  dbClient: Pick<typeof db, "transaction"> = db,
): Promise<ConvertProspectResult> {
  return dbClient.transaction(async (tx) => {
    const [prospect] = await tx.select().from(prospectsTable).where(eq(prospectsTable.id, prospectId));
    if (!prospect) return { ok: false, status: 404, error: "prospect_not_found" };

    if (prospect.convertedClientId) {
      const [existing] = await tx.select().from(clientsTable).where(eq(clientsTable.id, prospect.convertedClientId));
      return { ok: false, status: 409, error: "already_converted", client: existing };
    }

    if (looksLikeTestSource(prospect.source) && !options.confirmTestSource) {
      return { ok: false, status: 409, error: "test_source_requires_confirmation" };
    }

    const [acceptedProposal] = await tx.select().from(proposalsTable)
      .where(and(eq(proposalsTable.prospectId, prospectId), eq(proposalsTable.status, "accepted")))
      .limit(1);
    if (!acceptedProposal) return { ok: false, status: 409, error: "no_accepted_proposal" };

    const [client] = await tx.insert(clientsTable).values({
      name: prospect.name,
      email: prospect.email,
      phone: prospect.phone,
      company: prospect.company,
      industry: prospect.industry,
      language: prospect.language,
      // Explicit — clientsTable.status defaults to "prospect", which would
      // be actively misleading on a client that just came FROM a real
      // prospect (see the design doc's §4 callout on this exact collision).
      // NOT "active" yet: Contrato Maestro V2 cláusula 4 — no production
      // work starts before the anticipo (cuota 1) is actually paid, same
      // rule for Founders and regular clients. `handleInstallmentPaid`
      // flips this to "active" once that specific capture is confirmed
      // (see on-installment-paid.ts). This does NOT gate Client Room access
      // — `clients.status` isn't read by any auth/scope check today, and
      // per Camila that stays true here on purpose; only the dashboard's
      // "active clients" reporting count is affected by this status.
      status: "pending_payment",
    }).returning();

    // Link, never migrate: diagnoses/proposals keep their original
    // prospectId untouched and gain clientId, same dual-FK pattern the
    // schema already uses for both tables.
    await tx.update(diagnosesTable).set({ clientId: client.id }).where(eq(diagnosesTable.prospectId, prospectId));
    await tx.update(proposalsTable).set({ clientId: client.id }).where(eq(proposalsTable.prospectId, prospectId));

    // Generates the deposit/cuota invoices for the proposal that justified
    // this conversion — client.id wasn't available yet when the proposal was
    // publicly accepted (createInstallmentInvoices requires it and silently
    // no-ops there for exactly this reason, see public-proposals.ts), so
    // without this call a prospect-converted client would never get a
    // payment schedule at all. Runs on the same `tx`: if this fails, the
    // client that was just created rolls back too, rather than existing
    // with no way to pay.
    await createInstallmentInvoices({ ...acceptedProposal, clientId: client.id }, tx);

    if (prospect.notes && prospect.notes.trim()) {
      await tx.insert(clientNotesTable).values({
        clientId: client.id,
        title: "Nota heredada del prospecto",
        category: "general",
        content: prospect.notes,
      });
    }

    await tx.insert(clientTimelineTable).values({
      clientId: client.id,
      eventType: "converted_from_prospect",
      title: "Convertido desde prospecto",
      description: `Prospecto #${prospect.id} (${prospect.name}) convertido por ${actor.label}. Propuesta aceptada: #${acceptedProposal.id} — "${acceptedProposal.title}".`,
    });

    // The real concurrency guard (see the comment above this function):
    // filters on convertedClientId IS NULL too, not just id, so a
    // transaction that lost the race to another one converting the same
    // prospect affects zero rows here and gets caught below — never silently
    // overwrites the winner's convertedClientId with its own.
    const updatedProspects = await tx.update(prospectsTable)
      .set({ convertedClientId: client.id, status: "converted", updatedAt: new Date() })
      .where(and(eq(prospectsTable.id, prospectId), isNull(prospectsTable.convertedClientId)))
      .returning({ id: prospectsTable.id });
    if (updatedProspects.length === 0) {
      throw new Error(`Conversión concurrente detectada para el prospecto ${prospectId} — otra transacción ganó la carrera; esta se revierte por completo.`);
    }

    return { ok: true, client };
  });
}
