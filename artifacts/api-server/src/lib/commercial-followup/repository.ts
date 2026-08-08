import { eq, and } from "drizzle-orm";
import { db, prospectsTable, commercialFollowupsTable, type Prospect } from "@workspace/db";
import { nextStageToSend } from "./eligibility";

export interface DueFollowup {
  prospect: Prospect;
  stage: number;
}

// Every "Lead" prospect sourced from the digital diagnosis funnel that's due
// for exactly one follow-up email right now, per nextStageToSend's
// one-stage-per-run rule.
export async function findDueFollowups(now = new Date()): Promise<DueFollowup[]> {
  const leads = await db.select().from(prospectsTable).where(
    and(eq(prospectsTable.status, "lead"), eq(prospectsTable.source, "diagnostico_digital")),
  );

  const due: DueFollowup[] = [];
  for (const prospect of leads) {
    const sent = await db.select({ stage: commercialFollowupsTable.stage })
      .from(commercialFollowupsTable)
      .where(eq(commercialFollowupsTable.prospectId, prospect.id));
    const stage = nextStageToSend(prospect.createdAt, now, new Set(sent.map((s) => s.stage)));
    if (stage !== null) due.push({ prospect, stage });
  }
  return due;
}

// The unique(prospectId, stage) constraint is the real safety net against a
// duplicate send — this insert is what a concurrent/duplicate cron run
// would fail on.
export async function recordFollowupSent(prospectId: number, stage: number, emailId: string | null): Promise<void> {
  await db.insert(commercialFollowupsTable).values({ prospectId, stage, emailId });
}
