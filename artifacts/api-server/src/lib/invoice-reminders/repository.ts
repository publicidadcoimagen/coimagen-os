import { and, eq, isNotNull } from "drizzle-orm";
import { db, invoicesTable, clientsTable, invoiceRemindersTable, type Invoice } from "@workspace/db";
import { stageForDueDate, type ReminderStage } from "./eligibility";

// Only "sent" counts as "billed, awaiting payment". "draft" was never shown
// to the client (nothing to be overdue about), "paid"/"cancelled" are
// resolved. This intentionally does NOT reuse dashboard.ts's overdue-count
// query, which checks status IN ('pending','draft') — inconsistent with the
// invoices list page's own "sent = pending" convention. Worth reconciling
// that query separately; not done here to keep this change scoped.
const UNPAID_STATUS = "sent";

export const STAFF_WINDOW_DAYS = 7;
export const CLIENT_WINDOW_DAYS = 3;

export type ReminderAudience = "staff" | "client";

export interface DueReminder {
  invoice: Invoice;
  clientName: string;
  clientEmail: string | null;
  stage: ReminderStage;
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function unpaidInvoicesWithClient(): Promise<Array<{ invoice: Invoice; clientName: string; clientEmail: string | null }>> {
  const rows = await db
    .select({ invoice: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
    .from(invoicesTable)
    .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(eq(invoicesTable.status, UNPAID_STATUS), isNotNull(invoicesTable.dueDate)));
  return rows;
}

async function alreadySentStages(invoiceId: number, audience: ReminderAudience): Promise<Set<string>> {
  const rows = await db
    .select({ stage: invoiceRemindersTable.stage })
    .from(invoiceRemindersTable)
    .where(and(eq(invoiceRemindersTable.invoiceId, invoiceId), eq(invoiceRemindersTable.audience, audience)));
  return new Set(rows.map((r) => r.stage));
}

async function findDue(audience: ReminderAudience, windowDays: number, now: Date, requireEmail: boolean): Promise<DueReminder[]> {
  const today = todayIso(now);
  const rows = await unpaidInvoicesWithClient();
  const due: DueReminder[] = [];

  for (const row of rows) {
    if (!row.invoice.dueDate) continue;
    if (requireEmail && !row.clientEmail) continue; // can't email a reminder with no address

    const stage = stageForDueDate(row.invoice.dueDate, today, windowDays);
    if (stage === null) continue;

    const sent = await alreadySentStages(row.invoice.id, audience);
    if (sent.has(stage)) continue;

    due.push({ invoice: row.invoice, clientName: row.clientName, clientEmail: row.clientEmail, stage });
  }

  return due;
}

// Invoices Coimagen staff should be alerted about right now (7-day window).
export async function findDueStaffAlerts(now = new Date()): Promise<DueReminder[]> {
  return findDue("staff", STAFF_WINDOW_DAYS, now, false);
}

// Invoices whose own client should be reminded right now (3-day window).
// requireEmail=true: no client email means no channel to reach them on, same
// "email-only" exclusion commercial-followup/repository.ts applies to leads.
export async function findDueClientReminders(now = new Date()): Promise<DueReminder[]> {
  return findDue("client", CLIENT_WINDOW_DAYS, now, true);
}

// The unique(invoiceId, audience, stage, channel) constraint is the real
// safety net against a duplicate send — this insert is what a concurrent or
// duplicate cron run would fail on.
export async function recordReminderSent(invoiceId: number, audience: ReminderAudience, stage: ReminderStage, emailId: string | null): Promise<void> {
  await db.insert(invoiceRemindersTable).values({ invoiceId, audience, stage, channel: "email", emailId });
}
