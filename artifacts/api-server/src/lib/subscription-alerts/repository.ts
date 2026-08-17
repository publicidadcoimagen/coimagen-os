import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable, clientsTable, subscriptionAlertsTable, type Subscription } from "@workspace/db";
import { isStalePendingAuthorization } from "./eligibility";

const STAGE = "pending_authorization_stale";

export interface StaleSubscription {
  subscription: Subscription;
  clientName: string;
}

export async function findStalePendingAuthorizations(now = new Date()): Promise<StaleSubscription[]> {
  const rows = await db
    .select({ subscription: subscriptionsTable, clientName: clientsTable.name })
    .from(subscriptionsTable)
    .innerJoin(clientsTable, eq(subscriptionsTable.clientId, clientsTable.id))
    .where(eq(subscriptionsTable.status, "pending_authorization"));

  const stale: StaleSubscription[] = [];
  for (const row of rows) {
    if (!isStalePendingAuthorization(row.subscription.createdAt, now)) continue;

    const [alreadySent] = await db.select({ id: subscriptionAlertsTable.id })
      .from(subscriptionAlertsTable)
      .where(and(eq(subscriptionAlertsTable.subscriptionId, row.subscription.id), eq(subscriptionAlertsTable.stage, STAGE)));
    if (alreadySent) continue;

    stale.push(row);
  }
  return stale;
}

// unique(subscriptionId, stage) is the real dedup guard — see
// subscription-alerts.ts schema comment.
export async function recordAlertSent(subscriptionId: number): Promise<void> {
  await db.insert(subscriptionAlertsTable).values({ subscriptionId, stage: STAGE });
}
