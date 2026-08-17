import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { db, prospectsTable, commercialFollowupsTable, proposalsTable, agentsTable, agentClientsTable, type Prospect } from "@workspace/db";
import { nextStageToSend } from "./eligibility";
import { AGENT_NAME } from "./agent";

export interface DueFollowup {
  prospect: Prospect;
  stage: number;
  // Only set for stage 3/4 — the real proposal link those templates need.
  // Absence of a proposal is what makes a prospect ineligible for those
  // stages in the first place (see findDueFollowups), so this is always
  // populated whenever stage is 3 or 4.
  proposalPublicToken?: string;
}

// Client ids that currently have this agent assigned (agent_clients) — i.e.
// whose plan includes prospect follow-up. Empty if the agent row doesn't
// exist yet (first boot, before ensureCommercialFollowupAgent runs) or no
// client has it assigned.
export async function eligibleClientIds(): Promise<number[]> {
  const [agent] = await db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.name, AGENT_NAME));
  if (!agent) return [];
  const rows = await db.select({ clientId: agentClientsTable.clientId }).from(agentClientsTable).where(eq(agentClientsTable.agentId, agent.id));
  return rows.map((r) => r.clientId);
}

// Every "Lead" prospect due for exactly one follow-up email right now, per
// nextStageToSend's one-stage-per-run rule. Multi-tenant (P-81 Fase A):
// scope is Coimagen's own Diagnóstico Digital funnel (clientId null) PLUS,
// for each client that has this agent assigned via agent_clients, that
// client's own leads regardless of source — a client's lead pipeline isn't
// Coimagen's "diagnostico_digital" funnel, so that source filter only ever
// applied to the internal tenant.
export async function findDueFollowups(now = new Date()): Promise<DueFollowup[]> {
  const clientIds = await eligibleClientIds();
  const scopeConditions = [and(isNull(prospectsTable.clientId), eq(prospectsTable.source, "diagnostico_digital"))];
  if (clientIds.length > 0) scopeConditions.push(inArray(prospectsTable.clientId, clientIds));

  const leads = await db.select().from(prospectsTable).where(
    and(eq(prospectsTable.status, "lead"), or(...scopeConditions)),
  );

  const due: DueFollowup[] = [];
  for (const prospect of leads) {
    // This module is email-only — a phone-only prospect (Jotform
    // WhatsApp/Facebook leads, P-81) has nothing to send to here. They stay
    // out of this funnel entirely until there's a channel to reach them on.
    if (!prospect.email) continue;

    const sent = await db.select({ stage: commercialFollowupsTable.stage })
      .from(commercialFollowupsTable)
      .where(eq(commercialFollowupsTable.prospectId, prospect.id));
    const stage = nextStageToSend(prospect.createdAt, now, new Set(sent.map((s) => s.stage)));
    if (stage === null) continue;

    if (stage === 3 || stage === 4) {
      // Correo 3/4 need a real proposal to link to — no proposal yet means
      // "not due", not "send a broken link". Staff creates the proposal
      // manually (POST /proposals); once it exists, the next cron run picks
      // this prospect back up at the same stage.
      const [proposal] = await db.select({ publicToken: proposalsTable.publicToken })
        .from(proposalsTable)
        .where(eq(proposalsTable.prospectId, prospect.id))
        .limit(1);
      if (!proposal) continue;
      due.push({ prospect, stage, proposalPublicToken: proposal.publicToken });
      continue;
    }

    due.push({ prospect, stage });
  }
  return due;
}

// The unique(prospectId, stage) constraint is the real safety net against a
// duplicate send — this insert is what a concurrent/duplicate cron run
// would fail on.
export async function recordFollowupSent(prospectId: number, stage: number, emailId: string | null): Promise<void> {
  await db.insert(commercialFollowupsTable).values({ prospectId, stage, emailId });
}
