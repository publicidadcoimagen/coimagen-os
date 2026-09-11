import { and, eq } from "drizzle-orm";
import { db, subscriptionAlertsTable } from "@workspace/db";

// Reuses subscriptionAlertsTable (already used for the "stuck in
// pending_authorization" staff alert) rather than a new table — same
// (subscriptionId, stage) unique-constraint-as-dedup-safety-net pattern.
// Unlike that alert (fires at most once ever), this one is meant to fire
// once per FAILURE EPISODE: clearPaymentFailedAlert removes the record the
// moment the subscription recovers (see handleRecurringPaymentCompleted),
// so a client who fails, recovers, and fails again months later gets a
// fresh Día 0 notice each time instead of only the first time ever.
const STAGE = "recurring_payment_failed";

export async function hasSentPaymentFailedAlert(subscriptionId: number): Promise<boolean> {
  const [row] = await db.select({ id: subscriptionAlertsTable.id }).from(subscriptionAlertsTable)
    .where(and(eq(subscriptionAlertsTable.subscriptionId, subscriptionId), eq(subscriptionAlertsTable.stage, STAGE)));
  return Boolean(row);
}

export async function recordPaymentFailedAlertSent(subscriptionId: number): Promise<void> {
  await db.insert(subscriptionAlertsTable).values({ subscriptionId, stage: STAGE });
}

export async function clearPaymentFailedAlert(subscriptionId: number): Promise<void> {
  await db.delete(subscriptionAlertsTable)
    .where(and(eq(subscriptionAlertsTable.subscriptionId, subscriptionId), eq(subscriptionAlertsTable.stage, STAGE)));
}
