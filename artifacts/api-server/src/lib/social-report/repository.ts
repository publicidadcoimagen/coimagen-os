import { eq, and, gte, lt, inArray } from "drizzle-orm";
import {
  db, clientsTable, contentCalendarItemsTable, contentCalendarTargetsTable, socialMonthlyReportsTable,
  type Client,
} from "@workspace/db";
import { summarizeMonth, monthRange, type MonthlySummary } from "./aggregate";

// Clients eligible for a report — module enabled, same convention as every
// other module-gated feature (P-79's enabledModules).
export async function findAutopublicadorClients(): Promise<Client[]> {
  const rows = await db.select().from(clientsTable);
  return rows.filter((c) => c.enabledModules.includes("autopublicador"));
}

export async function buildClientMonthlySummary(clientId: number, month: string): Promise<MonthlySummary> {
  const { start, end } = monthRange(month);

  const items = await db.select({ generationCostUsd: contentCalendarItemsTable.generationCostUsd })
    .from(contentCalendarItemsTable)
    .where(and(
      eq(contentCalendarItemsTable.clientId, clientId),
      gte(contentCalendarItemsTable.createdAt, start),
      lt(contentCalendarItemsTable.createdAt, end),
    ));

  const itemIds = await db.select({ id: contentCalendarItemsTable.id })
    .from(contentCalendarItemsTable)
    .where(eq(contentCalendarItemsTable.clientId, clientId));
  const ids = itemIds.map((r) => r.id);

  const targets = ids.length === 0 ? [] : await db.select({ network: contentCalendarTargetsTable.network, status: contentCalendarTargetsTable.status })
    .from(contentCalendarTargetsTable)
    .where(and(
      inArray(contentCalendarTargetsTable.calendarItemId, ids),
      gte(contentCalendarTargetsTable.publishedAt, start),
      lt(contentCalendarTargetsTable.publishedAt, end),
    ));

  return summarizeMonth(targets, items);
}

export async function reportAlreadySent(clientId: number, month: string): Promise<boolean> {
  const [row] = await db.select({ id: socialMonthlyReportsTable.id }).from(socialMonthlyReportsTable)
    .where(and(eq(socialMonthlyReportsTable.clientId, clientId), eq(socialMonthlyReportsTable.month, month)));
  return !!row;
}

// Insert-then-send-would-risk-losing-the-email-if-it-crashes-after; send-
// then-insert risks a duplicate send on a retry instead — same tradeoff
// every other sequence in this codebase already accepts (dedup row written
// right after a successful send, not before).
export async function recordReportSent(clientId: number, month: string, emailId: string | null): Promise<void> {
  await db.insert(socialMonthlyReportsTable).values({ clientId, month, emailId }).onConflictDoNothing();
}
