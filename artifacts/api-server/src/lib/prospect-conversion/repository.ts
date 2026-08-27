import { and, eq } from "drizzle-orm";
import { db, clientsTable, prospectsTable, proposalsTable, diagnosesTable, clientNotesTable, clientTimelineTable, type Client } from "@workspace/db";

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
// it was, converted_client_id stays null, safe to retry (see the UNIQUE
// constraint on that column, the real idempotency guard, not this
// pre-check).
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
      status: "active",
    }).returning();

    // Link, never migrate: diagnoses/proposals keep their original
    // prospectId untouched and gain clientId, same dual-FK pattern the
    // schema already uses for both tables.
    await tx.update(diagnosesTable).set({ clientId: client.id }).where(eq(diagnosesTable.prospectId, prospectId));
    await tx.update(proposalsTable).set({ clientId: client.id }).where(eq(proposalsTable.prospectId, prospectId));

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

    await tx.update(prospectsTable).set({ convertedClientId: client.id, updatedAt: new Date() }).where(eq(prospectsTable.id, prospectId));

    return { ok: true, client };
  });
}
