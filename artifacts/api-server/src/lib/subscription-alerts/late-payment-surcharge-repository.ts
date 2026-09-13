import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable, clientsTable, subscriptionAlertsTable, type Subscription } from "@workspace/db";
import { isDueForLatePaymentSurcharge } from "./late-payment-surcharge";

// Reuses subscriptionAlertsTable's (subscriptionId, stage) dedup pattern —
// same table as "pending_authorization_stale" and "recurring_payment_failed"
// (Día 0). Fires once per past_due EPISODE: clearLatePaymentSurchargeAlert
// removes the record the moment the subscription reactivates (see
// webhooks-paypal.ts's handleRecurringPaymentCompleted, same clearing point
// as clearPaymentFailedAlert), so a client who fails, recovers, and fails
// again months later gets a fresh Día 3 surcharge each episode.
const STAGE = "late_payment_surcharge_day3";

export interface PastDueSubscription {
  subscription: Subscription;
  clientName: string;
  clientEmail: string | null;
}

export async function findSubscriptionsDueForSurcharge(now = new Date()): Promise<PastDueSubscription[]> {
  const rows = await db
    .select({ subscription: subscriptionsTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
    .from(subscriptionsTable)
    .innerJoin(clientsTable, eq(subscriptionsTable.clientId, clientsTable.id))
    .where(eq(subscriptionsTable.status, "past_due"));

  const due: PastDueSubscription[] = [];
  for (const row of rows) {
    const since = row.subscription.updatedAt ?? row.subscription.createdAt;
    if (!isDueForLatePaymentSurcharge(since, now)) continue;

    const [alreadySent] = await db.select({ id: subscriptionAlertsTable.id })
      .from(subscriptionAlertsTable)
      .where(and(eq(subscriptionAlertsTable.subscriptionId, row.subscription.id), eq(subscriptionAlertsTable.stage, STAGE)));
    if (alreadySent) continue;

    due.push(row);
  }
  return due;
}

export async function recordSurchargeAlertSent(subscriptionId: number): Promise<void> {
  await db.insert(subscriptionAlertsTable).values({ subscriptionId, stage: STAGE });
}

export async function clearLatePaymentSurchargeAlert(subscriptionId: number): Promise<void> {
  await db.delete(subscriptionAlertsTable)
    .where(and(eq(subscriptionAlertsTable.subscriptionId, subscriptionId), eq(subscriptionAlertsTable.stage, STAGE)));
}
